import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listProfiles, upsertProfile } from '@/api/endpoints';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/app-store';
import { distanceKm } from '@/utils/location';
import { FRESH_SLOW_MS } from './shared';
import { profilesQuery } from './oficios';

export interface SavedUserLocation {
  lat: number;
  lng: number;
  address: string;
}

interface NominatimReversePayload {
  display_name?: string;
  address?: {
    road?: string;
    pedestrian?: string;
    house_number?: string;
    neighbourhood?: string;
    suburb?: string;
    quarter?: string;
    city_district?: string;
    town?: string;
    city?: string;
  };
}

export async function reverseGeocodeCoords(c: { lat: number; lng: number }): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${c.lat}&lon=${c.lng}&accept-language=es`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = (await res.json()) as NominatimReversePayload;
      const addr = data.address;
      if (addr) {
        const calle = [addr.road || addr.pedestrian, addr.house_number].filter(Boolean).join(' ');
        const zona = addr.neighbourhood || addr.suburb || addr.quarter || addr.city_district;
        const ciudad = addr.town || addr.city || 'Castilla';
        const parts = [calle, zona, ciudad].filter(
          (part, idx, arr) => Boolean(part) && arr.indexOf(part) === idx
        );
        if (parts.length > 0) return parts.join(', ');
      }
      if (data.display_name) {
        return data.display_name
          .split(',')
          .slice(0, 3)
          .map((s) => s.trim())
          .join(', ');
      }
    }
  } catch {
    // Fallback abajo
  }
  return `Castilla, Piura (${c.lat.toFixed(4)}, ${c.lng.toFixed(4)})`;
}

export function useMySavedLocation() {
  const qc = useQueryClient();
  const userId = useAppStore((s) => s.userId);
  const zoneId = useAppStore((s) => s.zoneId);

  return useQuery({
    queryKey: ['mySavedLocation', userId, zoneId],
    enabled: Boolean(userId),
    // Solo cambia con useSaveMyLocation, que invalida; incluye un viaje a Auth y a Nominatim.
    staleTime: FRESH_SLOW_MS,
    queryFn: async (): Promise<SavedUserLocation | null> => {
      // 1. Leer de Supabase Auth user_metadata (persistido en BD para cualquier usuario)
      const { data: authData } = await supabase.auth.getUser();
      const meta = authData.user?.user_metadata as
        | { location_lat?: number; location_lng?: number; location_address?: string }
        | undefined;

      let lat = typeof meta?.location_lat === 'number' ? meta.location_lat : null;
      let lng = typeof meta?.location_lng === 'number' ? meta.location_lng : null;
      let address = typeof meta?.location_address === 'string' ? meta.location_address.trim() : '';

      // 2. Respaldo desde professional_profiles si aún no estaba en metadata
      if ((lat === null || lng === null) && zoneId) {
        try {
          const profiles = await qc.fetchQuery(profilesQuery(zoneId));
          const mineWithLoc = profiles.find((p) => p.userId === userId && p.location);
          if (mineWithLoc?.location) {
            lat = mineWithLoc.location.lat;
            lng = mineWithLoc.location.lng;
          }
        } catch {
          // Ignorar error de red
        }
      }

      if (lat === null || lng === null) return null;

      if (!address) {
        address = await reverseGeocodeCoords({ lat, lng });
      }

      return { lat, lng, address };
    },
  });
}

export function useSaveMyLocation() {
  const qc = useQueryClient();
  const userId = useAppStore((s) => s.userId);
  const zoneId = useAppStore((s) => s.zoneId);

  return useMutation({
    mutationFn: async (input: { lat: number; lng: number; address: string }): Promise<SavedUserLocation> => {
      if (!userId) throw new Error('Tu sesión no está activa.');
      const cleanAddress = input.address.trim() || (await reverseGeocodeCoords(input));

      // 1. Determinar si las nuevas coordenadas corresponden a otra zona de Castilla
      let newZoneId = zoneId;
      try {
        const { data: zonesData } = await supabase.from('zones').select('id, center_lat, center_lng');
        const conCoords = (zonesData ?? []).filter(
          (z: { center_lat?: number | null; center_lng?: number | null }) =>
            z.center_lat != null && z.center_lng != null,
        );
        if (conCoords.length > 0) {
          const closest = conCoords.reduce<{ id: string; km: number } | null>(
            (mejor, z: { id: string; center_lat: number; center_lng: number }) => {
              const km = distanceKm(input.lat, input.lng, z.center_lat, z.center_lng);
              return !mejor || km < mejor.km ? { id: z.id, km } : mejor;
            },
            null,
          );
          if (closest) {
            newZoneId = closest.id;
          }
        }
      } catch {
        // Si no se pueden consultar las zonas, se preserva el zoneId actual
      }

      // 2. Guardar en Supabase Auth user_metadata (persiste en BD aunque no tenga oficios aún)
      const { error: authErr } = await supabase.auth.updateUser({
        data: {
          location_lat: input.lat,
          location_lng: input.lng,
          location_address: cleanAddress,
          zone_id: newZoneId,
        },
      });
      if (authErr) throw new Error(authErr.message);

      // 3. Actualizar la tabla public.users para coherencia relacional
      try {
        await supabase.from('users').update({ zone_id: newZoneId }).eq('id', userId);
      } catch {
        // Continuar si la política RLS restringe el update directo
      }

      // 4. Si tiene oficios registrados, actualizar también sus coordenadas en professional_profiles
      const effectiveZoneId = newZoneId || zoneId;
      if (effectiveZoneId) {
        try {
          const profiles = await listProfiles({ zoneId: effectiveZoneId });
          const mine = profiles.filter((p) => p.user_id === userId);
          for (const prof of mine) {
            await upsertProfile({
              id: prof.id,
              oficio_id: prof.oficio_id,
              zone_id: effectiveZoneId,
              description: prof.description,
              years_experience: prof.years_experience,
              location_lat: input.lat,
              location_lng: input.lng,
            });
          }
        } catch {
          // Sin oficios visibles: se conserva la ubicación en Auth
        }
      }

      // 5. Actualizar store global si cambió la zona
      if (newZoneId && newZoneId !== zoneId) {
        useAppStore.setState({ zoneId: newZoneId });
      }

      return { lat: input.lat, lng: input.lng, address: cleanAddress };
    },
    onSuccess: (saved) => {
      const currentZoneId = useAppStore.getState().zoneId;
      qc.setQueryData(['mySavedLocation', userId, currentZoneId], saved);
      qc.invalidateQueries({ queryKey: ['mySavedLocation'] });
      qc.invalidateQueries({ queryKey: ['profiles'] });
      qc.invalidateQueries({ queryKey: ['favores'] });
      qc.invalidateQueries({ queryKey: ['zones'] });
    },
  });
}
