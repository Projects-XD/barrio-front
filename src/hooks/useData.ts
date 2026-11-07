import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { ApiError } from '@/api/client';
import {
  blockConversationUser,
  createFavor,
  createReport,
  deleteFavor,
  deleteProfile,
  expressInterest,
  getEmergencyState,
  getConversation,
  getFavorById,
  getUnreadNotificationCount,
  getProfileById,
  getVouchStatus,
  listConversations,
  listFavors,
  listMessages,
  listNotifications,
  listOficios,
  listProfiles,
  listReports,
  listResources,
  listServices,
  listZones,
  markNotificationRead,
  reportConversationUser,
  reportFavor,
  sendMessage,
  unblockConversationUser,
  updateConversation,
  updateFavor,
  upsertProfile,
  vouchProfile,
  type BackendConversation,
  type BackendFavor,
  type BackendMessage,
  type ReportReason,
  type BackendNotification,
  type BackendProfile,
  type BackendReport,
  type BackendResource,
  type BackendService,
  type UpdateFavorPayload,
} from '@/api/endpoints';
import { supabase } from '@/lib/supabase';
import { enqueue, listPending, type OutboxItem } from '@/offline/outbox';
import { flushOutbox } from '@/offline/sync';
import { useAppStore } from '@/store/app-store';
import type {
  CriticalResource,
  Favor,
  FavorType,
  FavorIntent,
  FavorUrgency,
  OficioCategory,
  ProfessionalProfile,
  ResourceType,
  SupportService,
  VulnerabilityReport,
} from '@/types';
import { generateUUID } from '@/utils/uuid';

const RESOURCE_TYPES: ResourceType[] = ['agua', 'medicinas', 'generador', 'transporte', 'alimentos', 'otro'];

// Cuánto se confía en la caché antes de volver a pedir. El valor por defecto (30 s) está en queryClient.ts.
const FRESH_LIVE_MS = 15_000; // favores, chat, avisos y emergencia: otro vecino los cambia sin avisar
const FRESH_PROFILES_MS = 2 * 60_000;
const FRESH_SLOW_MS = 5 * 60_000; // solo cambian por acciones del propio vecino, o casi nunca
const KEEP_LONG_MS = 30 * 60_000; // gcTime de lo que conviene conservar al salir de la pantalla
const CATALOG = { staleTime: KEEP_LONG_MS, gcTime: 60 * 60_000 }; // zonas y oficios, datos sembrados
// ponytail: tope de favores activos por zona en mapa e inicio; paginar el mapa si una zona lo supera.
const FAVORS_LIST_LIMIT = 100; // máximo que acepta GET /favors (validators.ts)

function isNetworkError(error: unknown) {
  return error instanceof ApiError && error.status === 0;
}

// =====================================================================// MAPEOS BACKEND -> UI
// =====================================================================
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
    location:
      bp.location_lat != null && bp.location_lng != null
        ? { lat: bp.location_lat, lng: bp.location_lng }
        : null,
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
    interestedCount: bf.interested_count ?? interests.length,
    hasInterestedByMe: Boolean(currentUserId) && interests.some((i) => i.user_id === currentUserId),
    createdAt: bf.created_at,
    location: bf.location_lat != null && bf.location_lng != null ? { lat: bf.location_lat, lng: bf.location_lng } : null,
    syncStatus: 'enviado',
    urgency: bf.urgency,
    intent: bf.intent ?? 'pedir',
    moderationStatus: bf.moderation_status,
    moderationReason: bf.moderation_reason ?? null,
    canEdit: bf.can_edit ?? false,
    isDeactivated: bf.is_deactivated ?? false,
    assignedToUserId: bf.assigned_to_user_id ?? null,
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
    location: typeof p.location_lat === 'number' && typeof p.location_lng === 'number' ? { lat: p.location_lat, lng: p.location_lng } : null,
    syncStatus: item.attempts > 0 ? 'error' : 'pendiente',
    // Las operaciones encoladas antes de existir este campo no lo traen.
    urgency: (p.urgency as FavorUrgency | undefined) ?? 'normal',
    intent: (p.intent as FavorIntent | undefined) ?? 'pedir',
    moderationStatus: 'aprobado',
    moderationReason: null,
    canEdit: false,
    isDeactivated: false,
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

// =====================================================================// ZONAS
// =====================================================================
export function useZones() {
  return useQuery({ queryKey: ['zones'], queryFn: listZones, ...CATALOG });
}

// =====================================================================// OFICIOS
// =====================================================================
// Todas las pantallas comparten una sola lista por zona; categoría y búsqueda filtran en memoria,
// así cambiar de filtro o escribir no gasta red.
const profilesQuery = (zoneId: string | null) => ({
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
      const { error: dbError } = await supabase.from('users').update({ avatar_url: url }).eq('id', userId);
      if (dbError) throw dbError;
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

      // 1. Guardar en Supabase Auth user_metadata (persiste en BD aunque no tenga oficios aún)
      const { error: authErr } = await supabase.auth.updateUser({
        data: {
          location_lat: input.lat,
          location_lng: input.lng,
          location_address: cleanAddress,
        },
      });
      if (authErr) throw new Error(authErr.message);

      // 2. Si tiene oficios registrados en su zona, actualizar también sus coordenadas en professional_profiles
      // La ubicación ya quedó guardada en Auth; los oficios son un extra que no debe bloquear el guardado.
      if (zoneId) {
        try {
          const profiles = await listProfiles({ zoneId });
          const mine = profiles.filter((p) => p.user_id === userId);
          for (const prof of mine) {
            await upsertProfile({
              id: prof.id,
              oficio_id: prof.oficio_id,
              zone_id: zoneId,
              description: prof.description,
              years_experience: prof.years_experience,
              location_lat: input.lat,
              location_lng: input.lng,
            });
          }
        } catch {
          // Sin oficios visibles (o zona no válida): se conserva la ubicación en Auth.
        }
      }

      return { lat: input.lat, lng: input.lng, address: cleanAddress };
    },
    onSuccess: (saved) => {
      qc.setQueryData(['mySavedLocation', userId, zoneId], saved);
      qc.invalidateQueries({ queryKey: ['mySavedLocation'] });
      qc.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

// =====================================================================// FAVORES
// =====================================================================
export function useFavors(type?: FavorType) {
  const zoneId = useAppStore((s) => s.zoneId);
  const userId = useAppStore((s) => s.userId);
  const userName = useAppStore((s) => s.userFullName);
  // Las pestañas siguen montadas al salir de ellas: sin esto el polling no se detiene nunca.
  const isFocused = useIsFocused();

  return useQuery({
    queryKey: ['favors', zoneId, type ?? 'todos'],
    // Respaldo del Realtime (useFavorRealtime): si el canal se cae, la lista se refresca cada 30 s.
    refetchInterval: 30_000,
    staleTime: FRESH_LIVE_MS,
    gcTime: KEEP_LONG_MS,
    subscribed: isFocused,
    enabled: Boolean(zoneId),
    queryFn: async (): Promise<Favor[]> => {
      const pending = (await listPending('create_favor'))
        .filter((item) => !type || item.payload.type === type)
        .map((item) => mapPendingFavor(item, userId, userName));

      let remote: BackendFavor[] = [];
      try {
        remote = await listFavors({ zoneId: zoneId!, type, limit: FAVORS_LIST_LIMIT });
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

export const FAVORS_PAGE_SIZE = 8;

// Una página de favores (0-based). Se pide uno de más para saber si existe la página siguiente.
// Los favores pendientes de envío (offline) solo aparecen en la primera página.
export function useFavorsPage(type: FavorType | undefined, page: number) {
  const zoneId = useAppStore((s) => s.zoneId);
  const userId = useAppStore((s) => s.userId);
  const userName = useAppStore((s) => s.userFullName);
  const isFocused = useIsFocused();

  return useQuery({
    queryKey: ['favors', zoneId, type ?? 'todos', 'page', page],
    staleTime: FRESH_LIVE_MS,
    subscribed: isFocused,
    enabled: Boolean(zoneId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ items: Favor[]; hasNext: boolean }> => {
      const pending =
        page === 0
          ? (await listPending('create_favor'))
              .filter((item) => !type || item.payload.type === type)
              .map((item) => mapPendingFavor(item, userId, userName))
          : [];

      let remote: BackendFavor[] = [];
      try {
        remote = await listFavors({
          zoneId: zoneId!,
          type,
          limit: FAVORS_PAGE_SIZE + 1,
          offset: page * FAVORS_PAGE_SIZE,
        });
      } catch (error) {
        if (!isNetworkError(error) || pending.length === 0) throw error;
      }

      const hasNext = remote.length > FAVORS_PAGE_SIZE;
      const pageRemote = remote.slice(0, FAVORS_PAGE_SIZE);
      const sentIds = new Set(pageRemote.map((f) => f.client_id));
      const stillPending = pending.filter((f) => !sentIds.has(f.id));
      return {
        items: [...stillPending, ...pageRemote.map((bf) => mapBackendFavorToFrontend(bf, userId))],
        hasNext,
      };
    },
  });
}

export function useFavor(id: string) {
  const userId = useAppStore((s) => s.userId);
  return useQuery({
    queryKey: ['favor', id],
    staleTime: FRESH_LIVE_MS,
    enabled: Boolean(id),
    queryFn: async () => mapBackendFavorToFrontend(await getFavorById(id), userId),
  });
}

export function useReportFavor(favorId: string) {
  const qc = useQueryClient();
  const userId = useAppStore((s) => s.userId);
  return useMutation({
    mutationFn: async (reason: string): Promise<{ hidden: boolean }> => {
      if (!userId) throw new Error('Tu sesión no está activa.');
      return await reportFavor(favorId, reason);
    },
    onSuccess: () => {
      invalidateFavor(qc, favorId);
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
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// Devuelve queued = true cuando el favor quedó en la cola offline.
export function useCreateFavor() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { type: FavorType; title: string; description: string | null; urgency: FavorUrgency; intent: FavorIntent; location?: { lat: number; lng: number } | null }) => {
      const { zoneId, isOnline } = useAppStore.getState();
      if (!zoneId) throw new Error('Tu cuenta no tiene zona asignada.');

      const clientId = generateUUID();
      const payload = {
        client_id: clientId,
        zone_id: zoneId,
        type: input.type,
        title: input.title,
        description: input.description,
        urgency: input.urgency,
        intent: input.intent,
        location_lat: input.location?.lat ?? null,
        location_lng: input.location?.lng ?? null,
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
      qc.invalidateQueries({ queryKey: ['outboxPending'] });
      void flushOutbox();
    },
  });
}

export function useOutboxPending() {
  const userId = useAppStore((s) => s.userId);
  const isOnline = useAppStore((s) => s.isOnline);
  return useQuery({
    queryKey: ['outboxPending', userId, isOnline],
    staleTime: 0, // lectura local de SQLite: barata y siempre debe reflejar la cola
    enabled: Boolean(userId),
    queryFn: () => listPending(),
  });
}

function invalidateFavor(qc: QueryClient, id: string) {
  qc.invalidateQueries({ queryKey: ['favor', id] });
  qc.invalidateQueries({ queryKey: ['favors'] });
}

export function useUpdateFavor(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateFavorPayload) => updateFavor(id, payload),
    onSuccess: () => invalidateFavor(qc, id),
  });
}

export function useDeleteFavor(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteFavor(id),
    onSuccess: () => invalidateFavor(qc, id),
  });
}

// =====================================================================// EMERGENCIA
// =====================================================================
export function useEmergencyState() {
  const zoneId = useAppStore((s) => s.zoneId);
  const token = useAppStore((s) => s.token);
  return useQuery({
    queryKey: ['emergency', zoneId],
    enabled: Boolean(zoneId && token),
    queryFn: () => getEmergencyState(zoneId!),
    refetchInterval: 30_000,
    staleTime: FRESH_LIVE_MS,
  });
}

export function useServices() {
  const zoneId = useAppStore((s) => s.zoneId);
  return useQuery({
    queryKey: ['services', zoneId],
    staleTime: FRESH_SLOW_MS,
    gcTime: KEEP_LONG_MS,
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
      qc.invalidateQueries({ queryKey: ['outboxPending'] });
      void flushOutbox();
    },
  });
}

// =====================================================================// NOTIFICACIONES
// =====================================================================
// Sin tiempo real: el contador se consulta cada 30 s mientras su pantalla está visible y con red.
const UNREAD_POLL_MS = 30_000;

export function useNotifications() {
  const userId = useAppStore((s) => s.userId);
  // Al volver a la pantalla se actualiza solo si los datos ya no están frescos.
  const isFocused = useIsFocused();
  return useQuery<BackendNotification[]>({
    queryKey: ['notifications', userId, 'list'],
    staleTime: FRESH_LIVE_MS,
    subscribed: isFocused,
    enabled: Boolean(userId),
    queryFn: () => listNotifications(),
  });
}

export function useUnreadNotificationCount() {
  const userId = useAppStore((s) => s.userId);
  const isOnline = useAppStore((s) => s.isOnline);
  const isFocused = useIsFocused();
  return useQuery({
    queryKey: ['notifications', userId, 'unread'],
    staleTime: FRESH_LIVE_MS,
    subscribed: isFocused,
    enabled: Boolean(userId) && isOnline,
    refetchInterval: UNREAD_POLL_MS,
    queryFn: async () => (await getUnreadNotificationCount()).count,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ============================================================================
// CHAT (solo con conexión: no pasa por la cola offline)
// ============================================================================

// Sin tiempo real: mientras el chat está abierto se consultan los mensajes cada pocos segundos.
const CHAT_POLL_MS = 4_000;

export function useConversations(favorId?: string) {
  const userId = useAppStore((s) => s.userId);
  return useQuery<BackendConversation[]>({
    queryKey: ['conversations', userId, favorId ?? 'all'],
    staleTime: FRESH_LIVE_MS,
    enabled: Boolean(userId),
    queryFn: () => listConversations(favorId),
  });
}

export function useConversation(id: string) {
  return useQuery<BackendConversation>({
    queryKey: ['conversation', id],
    staleTime: FRESH_LIVE_MS,
    enabled: Boolean(id),
    queryFn: () => getConversation(id),
  });
}

export function useMessages(conversationId: string) {
  const isOnline = useAppStore((s) => s.isOnline);
  return useQuery<BackendMessage[]>({
    queryKey: ['messages', conversationId],
    staleTime: 0, // abrir un chat siempre trae lo último y marca como leído
    gcTime: 2 * 60_000,
    enabled: Boolean(conversationId) && isOnline,
    refetchInterval: CHAT_POLL_MS,
    queryFn: () => listMessages(conversationId),
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendMessage(conversationId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useUpdateConversation(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changes: { muted?: boolean; closed?: true }) => updateConversation(conversationId, changes),
    onSuccess: (updated) => {
      qc.setQueryData(['conversation', conversationId], (prev: BackendConversation | undefined) =>
        prev ? { ...prev, ...updated } : updated,
      );
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useBlockConversationUser(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => blockConversationUser(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useUnblockConversationUser(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unblockConversationUser(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useReportConversationUser(conversationId: string) {
  return useMutation({
    mutationFn: (input: { reason: ReportReason; details?: string }) =>
      reportConversationUser(conversationId, input.reason, input.details),
  });
}
