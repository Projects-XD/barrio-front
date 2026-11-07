import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { ApiError } from '@/api/client';
import { sendSyncBatch } from '@/api/endpoints';
import { queryClient } from '@/lib/queryClient';
import { useAppStore } from '@/store/app-store';
import { listPending, markFailed, markSent } from './outbox';

let flushing = false;

export async function flushOutbox() {
  const { isOnline, token } = useAppStore.getState();
  if (flushing || !isOnline || !token) return;
  flushing = true;

  try {
    const pending = await listPending();
    if (pending.length === 0) return;

    let results;
    try {
      const response = await sendSyncBatch(
        pending.map((op) => ({
          client_id: op.clientId,
          operation: op.operation,
          payload: op.payload,
        })),
      );
      results = response.results;
    } catch (error) {
      // Sin red, el envío se reintenta luego y no cuenta como intento fallido.
      if (error instanceof ApiError && error.status === 0) return;
      const message = error instanceof Error ? error.message : 'Error al sincronizar';
      await Promise.all(pending.map((op) => markFailed(op.clientId, message)));
      return;
    }

    for (const result of results) {
      if (result.status === 'enviado') {
        await markSent(result.client_id);
      } else {
        await markFailed(result.client_id, result.error ?? 'Error al sincronizar');
      }
    }

    queryClient.invalidateQueries({ queryKey: ['favors'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
  } catch {
    // Un fallo de SQLite no debe tumbar la app; la cola se reintenta en el siguiente cambio de red.
  } finally {
    flushing = false;
  }
}

export function useOfflineSync() {
  useEffect(() => {
    const unsubNetInfo = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      useAppStore.getState().setOnline(online);
    });

    const unsubStore = useAppStore.subscribe((state, prev) => {
      const cameOnline = state.isOnline && !prev.isOnline;
      const loggedIn = Boolean(state.token) && !prev.token;
      if (cameOnline || loggedIn) void flushOutbox();
    });

    void flushOutbox();

    return () => {
      unsubNetInfo();
      unsubStore();
    };
  }, []);
}
