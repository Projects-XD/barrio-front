import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteProfile, getProfileById, getVouchStatus, listOficios, listProfiles, listZones, suggestProfileDescription, upsertProfile, vouchProfile, contactProfile } from '@/api/endpoints';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/app-store';
import type { OficioCategory, ProfessionalProfile } from '@/types';
import { FRESH_PROFILES_MS, KEEP_LONG_MS, CATALOG } from './shared';
import { mapBackendProfileToFrontend } from './mappers';

// =====================================================================// ZONAS
// =====================================================================
export function useZones() {
  return useQuery({ queryKey: ['zones'], queryFn: listZones, ...CATALOG });
}

// =====================================================================// OFICIOS
// =====================================================================
// Todas las pantallas comparten una sola lista por zona; categoría y búsqueda filtran en memoria,
// así cambiar de filtro o escribir no gasta red.
export const profilesQuery = (zoneId: string | null) => ({
  queryKey: ['profiles', zoneId],
  staleTime: FRESH_PROFILES_MS,
  gcTime: KEEP_LONG_MS,
  queryFn: async (): Promise<ProfessionalProfile[]> =>
    (await listProfiles({ zoneId: zoneId! })).map((bp) => mapBackendProfileToFrontend(bp)),
});

export function useProfiles(category?: OficioCategory, search?: string) {
  const zoneId = useAppStore((s) => s.zoneId);
  const q = search?.toLowerCase().trim();

  return useQuery({
    ...profilesQuery(zoneId),
    enabled: Boolean(zoneId),
    select: (profiles) =>
      !category && !q
        ? profiles
        : profiles.filter(
            (p) =>
              (!category || p.oficio.category === category) &&
              (!q ||
                p.user.fullName.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q) ||
                p.oficio.name.toLowerCase().includes(q)),
          ),
  });
}

export function useProfile(id: string) {
  const userId = useAppStore((s) => s.userId);

  return useQuery({
    queryKey: ['profile', id, userId],
    enabled: Boolean(id),
    queryFn: async (): Promise<ProfessionalProfile | null> => {
      const [bp, hasVouched] = await Promise.all([
        getProfileById(id),
        userId
          ? getVouchStatus(id)
              .then((r) => r.hasVouched)
              .catch(() => false)
          : false,
      ]);
      return mapBackendProfileToFrontend(bp, hasVouched);
    },
  });
}

// Los errores (403 otra zona, 409 duplicado) llegan a la pantalla tal cual.
export function useVouch(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => vouchProfile(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', id] });
      qc.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useContactProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, initialMessage }: { profileId: string; initialMessage?: string }) =>
      contactProfile(profileId, initialMessage),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useMyProfile() {
  const zoneId = useAppStore((s) => s.zoneId);
  const userId = useAppStore((s) => s.userId);

  return useQuery({
    ...profilesQuery(zoneId),
    enabled: Boolean(zoneId && userId),
    select: (profiles) => profiles.find((p) => p.userId === userId) ?? null,
  });
}

export function useMyAvatarUrl() {
  const userId = useAppStore((s) => s.userId);
  return useQuery({
    queryKey: ['myAvatar', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data?.avatar_url ?? null;
    },
  });
}

export function useUpdateAvatar() {
  const qc = useQueryClient();
  const userId = useAppStore((s) => s.userId);
  return useMutation({
    mutationFn: async (localUri: string): Promise<string> => {
      if (!userId) throw new Error('Tu sesión no está activa.');
      const body = await (await fetch(localUri)).arrayBuffer();
      const path = `${userId}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, body, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const { data: updated, error: dbError } = await supabase
        .from('users')
        .update({ avatar_url: url })
        .eq('id', userId)
        .select('id');
      if (dbError) throw dbError;
      if (!updated || updated.length === 0) {
        throw new Error('No se pudo guardar la foto: tu sesión no tiene permiso para actualizar tu perfil. Cierra sesión y vuelve a entrar.');
      }
      return url;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myAvatar', userId] }),
  });
}

export function useMyProfiles() {
  const zoneId = useAppStore((s) => s.zoneId);
  const userId = useAppStore((s) => s.userId);

  return useQuery({
    ...profilesQuery(zoneId),
    enabled: Boolean(zoneId && userId),
    select: (profiles) => profiles.filter((p) => p.userId === userId),
  });
}

export function useSuggestDescription() {
  return useMutation({ mutationFn: suggestProfileDescription });
}

export function useUpsertMyProfile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      category: OficioCategory;
      description: string;
      yearsExperience: number;
      existingId?: string;
      location?: { lat: number; lng: number } | null;
    }) => {
      const zoneId = useAppStore.getState().zoneId;
      if (!zoneId) throw new Error('Tu cuenta no tiene zona asignada.');

      const oficios = await qc.fetchQuery({ queryKey: ['oficios'], queryFn: listOficios, ...CATALOG });
      const oficio = oficios.find((o) => o.category === input.category);
      if (!oficio) throw new Error('Ese oficio no está disponible en el catálogo.');

      return upsertProfile({
        ...(input.existingId ? { id: input.existingId } : {}),
        oficio_id: oficio.id,
        zone_id: zoneId,
        description: input.description,
        years_experience: input.yearsExperience,
        ...(input.location ? { location_lat: input.location.lat, location_lng: input.location.lng } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useDeleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProfile(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['profiles'] });
      qc.invalidateQueries({ queryKey: ['profile', id] });
    },
  });
}
