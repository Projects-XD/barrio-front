import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFavor,
  getFavorById,
  getProfileById,
  listFavors,
  listProfiles,
  vouchProfile,
  type BackendFavor,
  type BackendProfile,
} from '@/api/endpoints';
import { favorsMock, profilesMock, reportsMock, resourcesMock, servicesMock } from '@/data/mock';
import { useAppStore } from '@/store/app-store';
import type { Favor, FavorType, OficioCategory, ProfessionalProfile } from '@/types';
import { generateUUID } from '@/utils/uuid';

const FALLBACK_ZONE_ID = 'a23c2ac0-4434-48bb-a091-89fbedf46dc6'; // Centro

/**
 * Transforma un perfil devuelto por la API del Backend al modelo tipado de la UI.
 */
export function mapBackendProfileToFrontend(
  bp: BackendProfile,
  _currentUserId?: string | null
): ProfessionalProfile {
  return {
    id: bp.id,
    userId: bp.user_id,
    user: {
      id: bp.user?.id ?? bp.user_id,
      fullName: bp.user?.full_name ?? 'Vecino Profesional',
      avatarUrl: bp.user?.avatar_url ?? null,
    },
    oficio: {
      id: bp.oficio?.id ?? bp.oficio_id,
      category: bp.oficio?.category ?? 'otro',
      name: bp.oficio?.name ?? 'Oficio',
    },
    zoneId: bp.zone_id ?? FALLBACK_ZONE_ID,
    description: bp.description ?? '',
    yearsExperience: bp.years_experience ?? null,
    distanceKm: bp.location_lat && bp.location_lng ? 0.4 : undefined,
    validatedCount: bp.validated_count ?? 0,
    isValidated: bp.is_validated ?? (bp.validated_count >= 2),
    hasVouchedByMe: false,
  };
}

/**
 * Transforma un favor devuelto por la API del Backend al modelo tipado de la UI.
 */
export function mapBackendFavorToFrontend(
  bf: BackendFavor,
  currentUserId?: string | null
): Favor {
  return {
    id: bf.id,
    authorId: bf.author_id,
    author: {
      id: bf.author?.id ?? bf.author_id,
      fullName: bf.author?.full_name ?? 'Vecino de la comunidad',
    },
    zoneId: bf.zone_id ?? FALLBACK_ZONE_ID,
    type: bf.type,
    title: bf.title,
    description: bf.description,
    status: bf.status,
    interestedCount: 0,
    hasInterestedByMe: currentUserId ? bf.author_id === currentUserId : false,
    createdAt: bf.created_at,
    syncStatus: bf.sync_status ?? 'enviado',
  };
}

// ============================================================================
// HOOKS: OFICIOS (Módulo Día a Día)
// ============================================================================

export function useProfiles(category?: OficioCategory, search?: string) {
  const zoneId = useAppStore((s) => s.zoneId) || FALLBACK_ZONE_ID;
  const currentUserId = useAppStore((s) => s.userId);

  return useQuery({
    queryKey: ['profiles', zoneId, category ?? 'todos', search ?? ''],
    queryFn: async (): Promise<ProfessionalProfile[]> => {
      try {
        const data = await listProfiles({
          zoneId,
          category: category || undefined,
        });

        let profiles = data.map((bp) => mapBackendProfileToFrontend(bp, currentUserId));

        if (search && search.trim()) {
          const q = search.toLowerCase().trim();
          profiles = profiles.filter(
            (p) =>
              p.user.fullName.toLowerCase().includes(q) ||
              p.description.toLowerCase().includes(q) ||
              p.oficio.name.toLowerCase().includes(q)
          );
        }

        return profiles;
      } catch {
        // Fallback a mock data si el backend aún no está iniciado
        let profiles = profilesMock;
        if (category) {
          profiles = profiles.filter((p) => p.oficio.category === category);
        }
        if (search && search.trim()) {
          const q = search.toLowerCase().trim();
          profiles = profiles.filter(
            (p) =>
              p.user.fullName.toLowerCase().includes(q) ||
              p.description.toLowerCase().includes(q) ||
              p.oficio.name.toLowerCase().includes(q)
          );
        }
        return profiles;
      }
    },
  });
}

export function useProfile(id: string) {
  const currentUserId = useAppStore((s) => s.userId);

  return useQuery({
    queryKey: ['profile', id],
    queryFn: async (): Promise<ProfessionalProfile | null> => {
      if (!id) return null;
      try {
        const bp = await getProfileById(id);
        return mapBackendProfileToFrontend(bp, currentUserId);
      } catch {
        return profilesMock.find((p) => p.id === id) ?? null;
      }
    },
    enabled: Boolean(id),
  });
}

export function useVouch(id: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        return await vouchProfile(id);
      } catch {
        const p = profilesMock.find((prof) => prof.id === id);
        if (p) {
          p.validatedCount += 1;
          p.hasVouchedByMe = true;
        }
        return { success: true };
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', id] });
      qc.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useMyProfile() {
  const currentUserId = useAppStore((s) => s.userId);

  return useQuery({
    queryKey: ['myProfile', currentUserId],
    queryFn: async (): Promise<ProfessionalProfile | null> => {
      const p = profilesMock.find((item) => item.userId === currentUserId || item.userId === 'me');
      return p ?? null;
    },
  });
}

export function useUpsertMyProfile() {
  const qc = useQueryClient();
  const currentUserId = useAppStore((s) => s.userId) || 'me';
  const userFullName = useAppStore((s) => s.userFullName) || 'Alexander García';

  return useMutation({
    mutationFn: async (input: {
      category: OficioCategory;
      description: string;
      yearsExperience: number;
    }) => {
      const existing = profilesMock.find((p) => p.userId === currentUserId || p.userId === 'me');
      if (existing) {
        existing.oficio.category = input.category;
        existing.description = input.description;
        existing.yearsExperience = input.yearsExperience;
        return existing;
      }

      const newP: ProfessionalProfile = {
        id: `prof-${Date.now()}`,
        userId: currentUserId,
        user: { id: currentUserId, fullName: userFullName, avatarUrl: null },
        oficio: { id: `oficio-${Date.now()}`, category: input.category, name: input.category },
        zoneId: useAppStore.getState().zoneId || FALLBACK_ZONE_ID,
        description: input.description,
        yearsExperience: input.yearsExperience,
        distanceKm: 0.1,
        validatedCount: 1,
        isValidated: false,
        hasVouchedByMe: false,
      };
      profilesMock.push(newP);
      return newP;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myProfile'] });
      qc.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

// ============================================================================
// HOOKS: FAVORES (Módulo Día a Día)
// ============================================================================

export function useFavors(type?: FavorType) {
  const zoneId = useAppStore((s) => s.zoneId) || FALLBACK_ZONE_ID;
  const currentUserId = useAppStore((s) => s.userId);

  return useQuery({
    queryKey: ['favors', zoneId, type ?? 'todos'],
    queryFn: async (): Promise<Favor[]> => {
      try {
        const data = await listFavors({
          zoneId,
          type: type || undefined,
        });

        return data.map((bf) => mapBackendFavorToFrontend(bf, currentUserId));
      } catch {
        // Fallback resiliente a mock data si el servidor local Node no está encendido
        let list = favorsMock;
        if (type) {
          list = list.filter((f) => f.type === type);
        }
        return list;
      }
    },
  });
}

export function useFavor(id: string) {
  const currentUserId = useAppStore((s) => s.userId);

  return useQuery({
    queryKey: ['favor', id],
    queryFn: async (): Promise<Favor | null> => {
      if (!id) return null;
      try {
        const bf = await getFavorById(id);
        return mapBackendFavorToFrontend(bf, currentUserId);
      } catch {
        return favorsMock.find((f) => f.id === id) ?? null;
      }
    },
    enabled: Boolean(id),
  });
}

export function useCreateFavor() {
  const qc = useQueryClient();
  const zoneId = useAppStore((s) => s.zoneId) || FALLBACK_ZONE_ID;

  return useMutation({
    mutationFn: async (input: {
      type: FavorType;
      title: string;
      description: string | null;
    }) => {
      try {
        // Regla de Frontend: Generar UUIDv4 como client_id para garantizar idempotencia
        const clientId = generateUUID();

        const created = await createFavor({
          client_id: clientId,
          zone_id: zoneId,
          type: input.type,
          title: input.title,
          description: input.description,
        });

        return mapBackendFavorToFrontend(created);
      } catch {
        // Fallback local en memoria si el backend no responde
        const fallbackFavor: Favor = {
          id: `favor-${Date.now()}`,
          authorId: 'me',
          author: { id: 'me', fullName: useAppStore.getState().userFullName || 'Tú' },
          zoneId,
          type: input.type,
          title: input.title,
          description: input.description,
          status: 'abierta',
          interestedCount: 0,
          hasInterestedByMe: false,
          createdAt: new Date().toISOString(),
          syncStatus: 'enviado',
        };
        favorsMock.unshift(fallbackFavor);
        return fallbackFavor;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['favors'] });
    },
  });
}

// ============================================================================
// HOOKS SECUNDARIOS (Módulo Emergencia - Sin modificar)
// ============================================================================

const delay = <T,>(value: T, ms = 200) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

export function useServices() {
  return useQuery({ queryKey: ['services'], queryFn: () => delay(servicesMock) });
}

export function useReports() {
  return useQuery({ queryKey: ['reports'], queryFn: () => delay(reportsMock) });
}

export function useResources() {
  return useQuery({ queryKey: ['resources'], queryFn: () => delay(resourcesMock) });
}
