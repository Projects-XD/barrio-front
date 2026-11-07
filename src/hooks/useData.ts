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
import { reportsMock, resourcesMock, servicesMock } from '@/data/mock';
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
    zoneId: bp.zone_id ?? '',
    description: bp.description ?? 'Sin descripción disponible',
    yearsExperience: bp.years_experience ?? null,
    distanceKm: 0.5,
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
  _currentUserId?: string | null
): Favor {
  return {
    id: bf.id,
    authorId: bf.author_id,
    author: {
      id: bf.author?.id ?? bf.author_id,
      fullName: bf.author?.full_name ?? 'Vecino',
    },
    zoneId: bf.zone_id ?? '',
    type: bf.type,
    title: bf.title,
    description: bf.description ?? null,
    status: bf.status,
    distanceKm: 0.3,
    interestedCount: 0,
    hasInterestedByMe: false,
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
    },
  });
}

export function useProfile(id: string) {
  const currentUserId = useAppStore((s) => s.userId);

  return useQuery({
    queryKey: ['profile', id],
    queryFn: async (): Promise<ProfessionalProfile | null> => {
      if (!id) return null;
      const bp = await getProfileById(id);
      return mapBackendProfileToFrontend(bp, currentUserId);
    },
    enabled: Boolean(id),
  });
}

export function useVouch(id: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await vouchProfile(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', id] });
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
      const data = await listFavors({
        zoneId,
        type: type || undefined,
      });

      return data.map((bf) => mapBackendFavorToFrontend(bf, currentUserId));
    },
  });
}

export function useFavor(id: string) {
  const currentUserId = useAppStore((s) => s.userId);

  return useQuery({
    queryKey: ['favor', id],
    queryFn: async (): Promise<Favor | null> => {
      if (!id) return null;
      const bf = await getFavorById(id);
      return mapBackendFavorToFrontend(bf, currentUserId);
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
