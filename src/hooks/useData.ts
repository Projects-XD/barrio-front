import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import {
  createFavor,
  createReport,
  createResource,
  expressInterest,
  getEmergencyState,
  getFavorById,
  getMyUserAndProfile,
  getProfileById,
  getVouchStatus,
  listFavors,
  listOficios,
  listProfiles,
  listReports,
  listResources,
  listServices,
  listZones,
  removeVouchProfile,
  updateFavor,
  updateMyUser,
  upsertProfile,
  vouchProfile,
  type BackendFavor,
  type BackendOficio,
  type BackendProfile,
  type BackendReport,
  type BackendResource,
  type BackendService,
  type BackendZone,
  type UpdateFavorPayload,
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
  ResourceKind,
  ResourceType,
  SupportService,
  VulnerabilityReport,
} from '@/types';
import { CASTILLA_CENTER } from '@/utils/geo';
import { distanceKm as calcDistanceKm } from '@/utils/location';
import { generateUUID } from '@/utils/uuid';

const RESOURCE_TYPES: ResourceType[] = [
  'agua',
  'medicinas',
  'generador',
  'transporte',
  'alimentos',
  'otro',
];

export const FALLBACK_CASTILLA_ZONE_ID = 'a23c2ac0-4434-48bb-a091-89fbedf46dc6';

export const FALLBACK_ZONES: BackendZone[] = [
  { id: FALLBACK_CASTILLA_ZONE_ID, name: 'Castilla', city: 'Piura', center_lat: -5.2016, center_lng: -80.6225 },
  { id: 'a23c2ac0-4434-48bb-a091-89fbedf46dc7', name: 'Miraflores', city: 'Piura', center_lat: -5.1652, center_lng: -80.6133 },
  { id: 'a23c2ac0-4434-48bb-a091-89fbedf46dc8', name: 'Río Seco', city: 'Piura', center_lat: -5.1383, center_lng: -80.6141 },
  { id: 'a23c2ac0-4434-48bb-a091-89fbedf46dc9', name: 'Las Mercedes', city: 'Piura', center_lat: -5.1475, center_lng: -80.4622 },
  { id: 'a23c2ac0-4434-48bb-a091-89fbedf46dca', name: 'Chapayra', city: 'Piura', center_lat: -5.1215, center_lng: -80.6046 },
  { id: 'a23c2ac0-4434-48bb-a091-89fbedf46dcb', name: 'Terela', city: 'Piura', center_lat: -5.0794, center_lng: -80.5941 },
  { id: 'a23c2ac0-4434-48bb-a091-89fbedf46dcc', name: 'El Papayo', city: 'Piura', center_lat: -5.045, center_lng: -80.6086 },
  { id: 'a23c2ac0-4434-48bb-a091-89fbedf46dcd', name: 'San Vicente', city: 'Piura', center_lat: -5.023, center_lng: -80.5944 },
];

const FALLBACK_OFICIOS: BackendOficio[] = [
  { id: '11111111-1111-4111-8111-111111111101', category: 'gasfiteria', name: 'Gasfitería', is_active: true },
  { id: '11111111-1111-4111-8111-111111111102', category: 'carpinteria', name: 'Carpintería', is_active: true },
  { id: '11111111-1111-4111-8111-111111111103', category: 'electricidad', name: 'Electricidad', is_active: true },
  { id: '11111111-1111-4111-8111-111111111104', category: 'cerrajeria', name: 'Cerrajería', is_active: true },
  { id: '11111111-1111-4111-8111-111111111105', category: 'clases', name: 'Clases particulares', is_active: true },
  { id: '11111111-1111-4111-8111-111111111106', category: 'paseador_mascotas', name: 'Paseador de mascotas', is_active: true },
  { id: '11111111-1111-4111-8111-111111111107', category: 'otro', name: 'Otros oficios', is_active: true },
];

function isNetworkError(error: unknown) {
  return error instanceof ApiError && error.status === 0;
}

function computeProfileDistance(lat?: number | null, lng?: number | null): number | undefined {
  if (typeof lat !== 'number' || typeof lng !== 'number') return undefined;
  const raw = calcDistanceKm(CASTILLA_CENTER.lat, CASTILLA_CENTER.lng, lat, lng);
  return Math.max(0.1, Math.round(raw * 10) / 10);
}

// ============================================================================
// MAPEOS BACKEND -> UI
// ============================================================================

export function mapBackendProfileToFrontend(
  bp: BackendProfile,
  hasVouchedByMe = false
): ProfessionalProfile {
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
    distanceKm: computeProfileDistance(bp.location_lat, bp.location_lng),
    validatedCount: bp.validated_count ?? 0,
    isValidated: bp.is_validated ?? (bp.validated_count ?? 0) >= 2,
    hasVouchedByMe,
  };
}

export function mapBackendFavorToFrontend(
  bf: BackendFavor,
  currentUserId?: string | null
): Favor {
  const rawInterests = bf.interests ?? [];
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
    interestedCount: rawInterests.length,
    hasInterestedByMe:
      Boolean(currentUserId) && rawInterests.some((i) => i.user_id === currentUserId),
    interests: rawInterests.map((i) => ({
      id: i.id,
      userId: i.user_id,
      userName: i.user?.full_name ?? 'Vecino solidario',
      message: i.message ?? null,
      createdAt: i.created_at ?? bf.created_at,
    })),
    createdAt: bf.created_at,
    syncStatus: 'enviado',
  };
}

function mapPendingFavor(
  item: OutboxItem,
  userId: string | null,
  userName: string | null
): Favor {
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
    interests: [],
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
    needs: (r.needs ?? []).filter((n): n is ResourceType =>
      RESOURCE_TYPES.includes(n as ResourceType)
    ),
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
    userName: r.user?.full_name ?? null,
  };
}

// ============================================================================
// ZONAS Y USUARIO ACTUAL
// ============================================================================

export function useZones() {
  return useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      try {
        const zones = await listZones();
        return zones.length > 0 ? zones : FALLBACK_ZONES;
      } catch (err) {
        if (isNetworkError(err)) return FALLBACK_ZONES;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useCurrentUser() {
  const token = useAppStore((s) => s.token);
  const userId = useAppStore((s) => s.userId);

  return useQuery({
    queryKey: ['currentUser', userId],
    enabled: Boolean(token && userId),
    staleTime: 2 * 60_000,
    retry: 1,
    queryFn: async () => {
      const res = await getMyUserAndProfile();
      const state = useAppStore.getState();
      if (res.user) {
        state.setSession({
          token: state.token ?? '',
          userId: res.user.id,
          zoneId: res.user.zone_id || state.zoneId || '',
          zoneName: res.user.zone?.name ?? state.zoneName,
          userFullName: res.user.full_name || state.userFullName,
          userEmail: state.userEmail,
          emergencyRole: res.user.emergency_role,
        });
      }
      return res;
    },
  });
}

export function useUpdateMyUser() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: { full_name?: string; zone_id?: string | null; emergency_role?: boolean }) =>
      updateMyUser(payload),
    onSuccess: (updated) => {
      const state = useAppStore.getState();
      state.setSession({
        token: state.token ?? '',
        userId: updated.id,
        zoneId: updated.zone_id || state.zoneId || '',
        zoneName: updated.zone?.name ?? state.zoneName,
        userFullName: updated.full_name || state.userFullName,
        userEmail: state.userEmail,
        emergencyRole: updated.emergency_role,
      });
      qc.invalidateQueries({ queryKey: ['currentUser'] });
      qc.invalidateQueries({ queryKey: ['myProfile'] });
      qc.invalidateQueries({ queryKey: ['profiles'] });
      qc.invalidateQueries({ queryKey: ['favors'] });
      qc.invalidateQueries({ queryKey: ['services'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['resources'] });
    },
  });
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
            p.oficio.name.toLowerCase().includes(q)
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

// Otorga visto bueno y actualiza inmediatamente la caché local y listados.
export function useVouch(id: string) {
  const qc = useQueryClient();
  const userId = useAppStore((s) => s.userId);

  return useMutation({
    mutationFn: () => vouchProfile(id),
    onSuccess: (res) => {
      if (res?.profile) {
        qc.setQueryData(
          ['profile', id, userId],
          mapBackendProfileToFrontend(res.profile, true)
        );
      }
      qc.invalidateQueries({ queryKey: ['profile', id] });
      qc.invalidateQueries({ queryKey: ['profiles'] });
      qc.invalidateQueries({ queryKey: ['myProfile'] });
    },
  });
}

export function useRemoveVouch(id: string) {
  const qc = useQueryClient();
  const userId = useAppStore((s) => s.userId);

  return useMutation({
    mutationFn: () => removeVouchProfile(id),
    onSuccess: (res) => {
      if (res?.profile) {
        qc.setQueryData(
          ['profile', id, userId],
          mapBackendProfileToFrontend(res.profile, false)
        );
      }
      qc.invalidateQueries({ queryKey: ['profile', id] });
      qc.invalidateQueries({ queryKey: ['profiles'] });
      qc.invalidateQueries({ queryKey: ['myProfile'] });
    },
  });
}

export function useOficios() {
  return useQuery({
    queryKey: ['oficios'],
    queryFn: async () => {
      try {
        const list = await listOficios();
        return list.length > 0 ? list : FALLBACK_OFICIOS;
      } catch (err) {
        if (isNetworkError(err)) return FALLBACK_OFICIOS;
        throw err;
      }
    },
    staleTime: 10 * 60_000,
  });
}

export function useMyProfile() {
  const zoneId = useAppStore((s) => s.zoneId);
  const userId = useAppStore((s) => s.userId);

  return useQuery({
    queryKey: ['myProfile', zoneId, userId],
    enabled: Boolean(zoneId && userId),
    queryFn: async (): Promise<ProfessionalProfile | null> => {
      try {
        const me = await getMyUserAndProfile();
        if (me.professionalProfile) {
          return mapBackendProfileToFrontend(me.professionalProfile);
        }
      } catch {
        // Fallback a búsqueda por lista de zona
      }
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

      const oficios = await qc.fetchQuery({
        queryKey: ['oficios'],
        queryFn: async () => {
          const list = await listOficios();
          return list.length > 0 ? list : FALLBACK_OFICIOS;
        },
      });
      const oficio = oficios.find((o) => o.category === input.category);
      if (!oficio) throw new Error('Ese oficio no está disponible en el catálogo.');

      return upsertProfile({
        ...(input.existingId ? { id: input.existingId } : {}),
        oficio_id: oficio.id,
        zone_id: zoneId,
        description: input.description,
        years_experience: input.yearsExperience,
        ...(input.location
          ? { location_lat: input.location.lat, location_lng: input.location.lng }
          : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myProfile'] });
      qc.invalidateQueries({ queryKey: ['currentUser'] });
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
      return [
        ...stillPending,
        ...remote.map((bf) => mapBackendFavorToFrontend(bf, userId)),
      ];
    },
  });
}

export function useFavor(id: string) {
  const userId = useAppStore((s) => s.userId);
  const userName = useAppStore((s) => s.userFullName);

  return useQuery({
    queryKey: ['favor', id, userId],
    enabled: Boolean(id),
    queryFn: async (): Promise<Favor> => {
      // Si el favor aún está en la cola offline local, mostrarlo directamente
      const pending = await listPending('create_favor');
      const localItem = pending.find((item) => item.clientId === id);
      if (localItem) {
        return mapPendingFavor(localItem, userId, userName);
      }

      const bf = await getFavorById(id);
      return mapBackendFavorToFrontend(bf, userId);
    },
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

export function useUpdateFavor(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateFavorPayload) => updateFavor(id, payload),
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
    mutationFn: async (input: {
      type: FavorType;
      title: string;
      description: string | null;
    }) => {
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
          const created = await createFavor(payload);
          return { queued: false, favorId: created.id };
        } catch (error) {
          if (!isNetworkError(error)) throw error;
        }
      }

      await enqueue(clientId, 'create_favor', payload);
      return { queued: true, favorId: clientId };
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

export function useCreateResource() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      kind: ResourceKind;
      resource: ResourceType;
      quantity?: number | null;
      notes?: string | null;
    }) => {
      const { zoneId } = useAppStore.getState();
      if (!zoneId) throw new Error('Tu cuenta no tiene zona asignada.');

      return createResource({
        zone_id: zoneId,
        kind: input.kind,
        resource: input.resource,
        quantity: input.quantity ?? null,
        notes: input.notes ?? null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources'] });
    },
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
