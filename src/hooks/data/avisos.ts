import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import {
  deleteNotification,
  deleteReadNotifications,
  getUnreadNotificationCount,
  listNotifications,
  markNotificationRead,
  type BackendNotification,
} from '@/api/endpoints';
import { useAppStore } from '@/store/app-store';
import { FRESH_LIVE_MS } from './shared';

// =====================================================================// NOTIFICACIONES
// =====================================================================
// Sin tiempo real: el contador se consulta cada 30 s mientras su pantalla está visible y con red.
const UNREAD_POLL_MS = 30_000;

export function useNotifications() {
  const userId = useAppStore((s) => s.userId);
  return useQuery<BackendNotification[]>({
    queryKey: ['notifications', userId, 'list'],
    staleTime: FRESH_LIVE_MS,
    enabled: Boolean(userId),
    queryFn: () => listNotifications(),
  });
}

export function useUnreadNotificationCount() {
  const userId = useAppStore((s) => s.userId);
  const isOnline = useAppStore((s) => s.isOnline);
  const isFocused = useIsFocused();
  const query = useQuery({
    queryKey: ['notifications', userId, 'unread'],
    staleTime: FRESH_LIVE_MS,
    enabled: Boolean(userId) && isOnline,
    refetchInterval: isFocused ? UNREAD_POLL_MS : false,
    queryFn: async () => (await getUnreadNotificationCount()).count,
  });
  // El intervalo se pausa con la pantalla tapada; al volver, consulta ya si el dato quedó viejo.
  const { isStale, isFetching, refetch } = query;
  useEffect(() => {
    if (isFocused && isStale && !isFetching && Boolean(userId) && isOnline) void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);
  return query;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// Quita de la lista al instante; si el backend falla, se restaura con el refetch.
function useRemoveNotifications<T>(fn: (arg: T) => Promise<unknown>, keep: (n: BackendNotification, arg: T) => boolean) {
  const qc = useQueryClient();
  const userId = useAppStore((s) => s.userId);
  return useMutation({
    mutationFn: fn,
    onMutate: (arg: T) =>
      qc.setQueryData<BackendNotification[]>(['notifications', userId, 'list'], (prev) => prev?.filter((n) => keep(n, arg))),
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export const useDeleteNotification = () =>
  useRemoveNotifications((id: string) => deleteNotification(id), (n, id) => n.id !== id);

export const useDeleteReadNotifications = () =>
  useRemoveNotifications(() => deleteReadNotifications(), (n) => !n.read_at);
