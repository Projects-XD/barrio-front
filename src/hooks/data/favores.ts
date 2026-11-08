import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { createFavor, deleteFavor, expressInterest, getFavorById, listFavors, reportFavor, updateFavor, type BackendFavor, type UpdateFavorPayload } from '@/api/endpoints';
import { enqueue, listPending } from '@/offline/outbox';
import { flushOutbox } from '@/offline/sync';
import { useAppStore } from '@/store/app-store';
import type { Favor, FavorType, FavorIntent, FavorUrgency } from '@/types';
import { generateUUID } from '@/utils/uuid';
import { FRESH_LIVE_MS, KEEP_LONG_MS, FAVORS_LIST_LIMIT, isNetworkError } from './shared';
import { mapBackendFavorToFrontend, mapPendingFavor } from './mappers';

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

export interface UseFavorsPageOptions {
  type?: FavorType;
  intent?: FavorIntent;
  mine?: boolean;
  page: number;
}

// Una página de favores (0-based). Se pide uno de más para saber si existe la página siguiente.
// Los favores pendientes de envío (offline) solo aparecen en la primera página.
export function useFavorsPage(
  optionsOrType: UseFavorsPageOptions | FavorType | undefined,
  maybePage: number = 0
) {
  const isObject = typeof optionsOrType === 'object' && optionsOrType !== null && 'page' in optionsOrType;
  const type = isObject ? optionsOrType.type : optionsOrType;
  const page = isObject ? optionsOrType.page : maybePage;
  const intent = isObject ? optionsOrType.intent : undefined;
  const mine = isObject ? optionsOrType.mine : undefined;

  const zoneId = useAppStore((s) => s.zoneId);
  const userId = useAppStore((s) => s.userId);
  const userName = useAppStore((s) => s.userFullName);
  const isFocused = useIsFocused();

  return useQuery({
    queryKey: ['favors', zoneId, type ?? 'todos', intent ?? 'todos', mine ? 'mine' : 'all', 'page', page],
    staleTime: FRESH_LIVE_MS,
    subscribed: isFocused,
    enabled: Boolean(zoneId),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ items: Favor[]; hasNext: boolean }> => {
      const pending =
        page === 0
          ? (await listPending('create_favor'))
              .filter((item) => {
                if (type && item.payload.type !== type) return false;
                if (intent && item.payload.intent !== intent) return false;
                return true;
              })
              .map((item) => mapPendingFavor(item, userId, userName))
          : [];

      let remote: BackendFavor[] = [];
      try {
        remote = await listFavors({
          zoneId: zoneId!,
          type,
          intent,
          mine,
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
