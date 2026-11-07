import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import {
  createFavor,
  createReport,
  expressInterest,
  getEmergencyState,
  getFavorById,
  getProfileById,
  getVouchStatus,
  listFavors,
  listOficios,
  listProfiles,
  listReports,
  listResources,
  listServices,
  listZones,
  upsertProfile,
  vouchProfile,
  type BackendFavor,
  type BackendProfile,
  type BackendReport,
  type BackendResource,
  type BackendService,
} from '@/api/endpoints';
import { enqueue, listPending, type OutboxItem } from '@/offline/outbox';
import { flushOutbox } from '@/offline/sync';
import { useAppStore } from '@/store/app-store';
import type {
  CriticalResource,
  Favor,
  FavorType,
  OficioCategory,
  ProfessionalProfile,
  ResourceType,
  SupportService,
  VulnerabilityReport,
} from '@/types';
import { generateUUID } from '@/utils/uuid';

const RESOURCE_TYPES: ResourceType[] = ['agua', 'medicinas', 'generador', 'transporte', 'alimentos', 'otro'];

function isNetworkError(error: unknown) {
  return error instanceof ApiError && error.status === 0;
}

// ============================================================================
// MAPEOS BACKEND -> UI
// ============================================================================

export function mapBackendProfileToFrontend(bp: BackendProfile, hasVouchedByMe = false): ProfessionalProfile {
  return {
    id: bp.id,
    userId: bp.user_id,
    user: {
      id: bp.user?.id ?? bp.user_id,
      fullName: bp.user?.full_name ?? 'Vecino',
      avatarUrl: bp.user?.avatar_url ?? null,
    },
    oficio: {
      id: bp.oficio?.id ?? bp.oficio_id,
      category: bp.oficio?.category ?? 'otro',
      name: bp.oficio?.name ?? 'Oficio',
    },
    zoneId: bp.zone_id ?? '',
    description: bp.description ?? '',
    yearsExperience: bp.years_experience ?? null,
    distanceKm: undefined,
    validatedCount: bp.validated_count ?? 0,
    isValidated: bp.is_validated ?? (bp.validated_count ?? 0) >= 2,
    hasVouchedByMe,
  };
}

export function mapBackendFavorToFrontend(bf: BackendFavor, currentUserId?: string | null): Favor {
  const interests = bf.interests ?? [];
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
    description: bf.description,
    status: bf.status,
    interestedCount: interests.length,
    hasInterestedByMe: Boolean(currentUserId) && interests.some((i) => i.user_id === currentUserId),
    createdAt: bf.created_at,
    syncStatus: 'enviado',
  };
}

function mapPendingFavor(item: OutboxItem, userId: string | null, userName: string | null): Favor {
  const p = item.payload;
  return {
    id: item.clientId,
    authorId: userId ?? 'me',
    author: { id: userId ?? 'me', fullName: userName ?? 'Tú' },
    zoneId: String(p.zone_id ?? ''),
    type: p.type as FavorType,
    title: String(p.title ?? ''),
    description: (p.description as string | null) ?? null,
    status: 'abierta',
    interestedCount: 0,
    hasInterestedByMe: false,
    createdAt: item.createdAt,
    syncStatus: item.attempts > 0 ? 'error' : 'pendiente',
  };
}

function mapService(s: BackendService): SupportService {
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    phone: s.phone ?? '',
    addressSummary: s.address_summary ?? '',
    hours: s.hours,
    isVerified: s.is_verified,
  };
}

function mapReport(r: BackendReport): VulnerabilityReport {
  return {
    id: r.id,
    zoneId: r.zone_id ?? '',
    approxLat: r.approx_lat ?? 0,
    approxLng: r.approx_lng ?? 0,
    description: r.description,
    needs: (r.needs ?? []).filter((n): n is ResourceType => RESOURCE_TYPES.includes(n as ResourceType)),
    status: r.status,
    isAnonymous: r.is_anonymous,
    reporterName: r.is_anonymous ? null : (r.reporter?.full_name ?? null),
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

function mapResource(r: BackendResource): CriticalResource {
  return {
    id: r.id,
    kind: r.kind,
    resource: r.resource,
    quantity: r.quantity,
    notes: r.notes,
    status: r.status,
  };
}

// ============================================================================
// ZONAS
// ============================================================================

export function useZones() {
  return useQuery({ queryKey: ['zones'], queryFn: listZones, staleTime: 5 * 60_000 });
}

// ============================================================================
// OFICIOS
// ============================================================================

export function useProfiles(category?: OficioCategory, search?: string) {
  const zoneId = useAppStore((s) => s.zoneId);

  return useQuery({
    queryKey: ['profiles', zoneId, category ?? 'todos', search ?? ''],
    enabled: Boolean(zoneId),
    queryFn: async (): Promise<ProfessionalProfile[]> => {
      const data = await listProfiles({ zoneId: zoneId!, category });
      let profiles = data.map((bp) => mapBackendProfileToFrontend(bp));
      const q = search?.toLowerCase().trim();
      if (q) {
        profiles = profiles.filter(
          (p) =>
            p.user.fullName.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.oficio.name.toLowerCase().includes(q),
        );
      }
      return profiles;
    },
  });
}

export function useProfile(id: string) {
  const userId = useAppStore((s) => s.userId);

  return useQuery({
    queryKey: ['profile', id, userId],
    enabled: Boolean(id),
    queryFn: async (): Promise<ProfessionalProfile | null> => {
      const bp = await getProfileById(id);
      let hasVouched = false;
      if (userId) {
        hasVouched = await getVouchStatus(id)
          .then((r) => r.hasVouched)
          .catch(() => false);
      }
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

export function useMyProfile() {
  const zoneId = useAppStore((s) => s.zoneId);
  const userId = useAppStore((s) => s.userId);

  return useQuery({
    queryKey: ['myProfile', zoneId, userId],
    enabled: Boolean(zoneId && userId),
    queryFn: async (): Promise<ProfessionalProfile | null> => {
      const data = await listProfiles({ zoneId: zoneId! });
      const mine = data.find((bp) => bp.user_id === userId);
      return mine ? mapBackendProfileToFrontend(mine) : null;
    },
  });
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

      const oficios = await qc.fetchQuery({ queryKey: ['oficios'], queryFn: listOficios });
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
      qc.invalidateQueries({ queryKey: ['myProfile'] });
      qc.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

// ============================================================================
// FAVORES
// ============================================================================

export function useFavors(type?: FavorType) {
  const zoneId = useAppStore((s) => s.zoneId);
  const userId = useAppStore((s) => s.userId);
  const userName = useAppStore((s) => s.userFullName);

  return useQuery({
    queryKey: ['favors', zoneId, type ?? 'todos'],
    enabled: Boolean(zoneId),
    queryFn: async (): Promise<Favor[]> => {
      const pending = (await listPending('create_favor'))
        .filter((item) => !type || item.payload.type === type)
        .map((item) => mapPendingFavor(item, userId, userName));

      let remote: BackendFavor[] = [];
      try {
        remote = await listFavors({ zoneId: zoneId!, type });
      } catch (error) {
        // Sin red se muestran al menos los favores pendientes del vecino.
        if (!isNetworkError(error) || pending.length === 0) throw error;
      }

      const sentIds = new Set(remote.map((f) => f.client_id));
      const stillPending = pending.filter((f) => !sentIds.has(f.id));
      return [...stillPending, ...remote.map((bf) => mapBackendFavorToFrontend(bf, userId))];
    },
  });
}

export function useFavor(id: string) {
  const userId = useAppStore((s) => s.userId);
  return useQuery({
    queryKey: ['favor', id],
    enabled: Boolean(id),
    queryFn: async () => mapBackendFavorToFrontend(await getFavorById(id), userId),
  });
}

export function useExpressInterest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message?: string) => expressInterest(id, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['favor', id] });
      qc.invalidateQueries({ queryKey: ['favors'] });
    },
  });
}

// Devuelve queued = true cuando el favor quedó en la cola offline.
export function useCreateFavor() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { type: FavorType; title: string; description: string | null }) => {
      const { zoneId, isOnline } = useAppStore.getState();
      if (!zoneId) throw new Error('Tu cuenta no tiene zona asignada.');

      const clientId = generateUUID();
      const payload = {
        client_id: clientId,
        zone_id: zoneId,
        type: input.type,
        title: input.title,
        description: input.description,
      };

      if (isOnline) {
        try {
          await createFavor(payload);
          return { queued: false };
        } catch (error) {
          if (!isNetworkError(error)) throw error;
        }
      }

      await enqueue(clientId, 'create_favor', payload);
      return { queued: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['favors'] });
      void flushOutbox();
    },
  });
}

// ============================================================================
// EMERGENCIA
// ============================================================================

export function useEmergencyState() {
  const zoneId = useAppStore((s) => s.zoneId);
  const token = useAppStore((s) => s.token);
  return useQuery({
    queryKey: ['emergency', zoneId],
    enabled: Boolean(zoneId && token),
    queryFn: () => getEmergencyState(zoneId!),
    refetchInterval: 30_000,
  });
}

export function useServices() {
  const zoneId = useAppStore((s) => s.zoneId);
  return useQuery({
    queryKey: ['services', zoneId],
    enabled: Boolean(zoneId),
    queryFn: async () => (await listServices(zoneId!)).map(mapService),
  });
}

export function useReports() {
  const zoneId = useAppStore((s) => s.zoneId);
  return useQuery({
    queryKey: ['reports', zoneId],
    enabled: Boolean(zoneId),
    queryFn: async () => (await listReports(zoneId!)).map(mapReport),
  });
}

export function useResources() {
  const zoneId = useAppStore((s) => s.zoneId);
  return useQuery({
    queryKey: ['resources', zoneId],
    enabled: Boolean(zoneId),
    queryFn: async () => (await listResources(zoneId!)).map(mapResource),
  });
}

export function useCreateReport() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      description: string;
      needs: ResourceType[];
      isAnonymous: boolean;
      location?: { lat: number; lng: number } | null;
    }) => {
      const { zoneId, isOnline } = useAppStore.getState();
      if (!zoneId) throw new Error('Tu cuenta no tiene zona asignada.');

      const payload = {
        zone_id: zoneId,
        lat: input.location?.lat ?? null,
        lng: input.location?.lng ?? null,
        description: input.description,
        needs: input.needs,
        is_anonymous: input.isAnonymous,
      };

      if (isOnline) {
        try {
          await createReport(payload);
          return { queued: false };
        } catch (error) {
          if (!isNetworkError(error)) throw error;
        }
      }

      await enqueue(generateUUID(), 'create_vulnerability_report', payload);
      return { queued: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      void flushOutbox();
    },
  });
}
