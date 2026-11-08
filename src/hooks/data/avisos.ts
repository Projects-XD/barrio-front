import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { getUnreadNotificationCount, listNotifications, markNotificationRead, type BackendNotification } from '@/api/endpoints';
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
  return useQuery({
    queryKey: ['notifications', userId, 'unread'],
    staleTime: FRESH_LIVE_MS,
    enabled: Boolean(userId) && isOnline,
    refetchInterval: isFocused ? UNREAD_POLL_MS : false,
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
