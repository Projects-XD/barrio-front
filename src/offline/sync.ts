import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { ApiError } from '@/api/client';
import { sendSyncBatch } from '@/api/endpoints';
import { queryClient } from '@/lib/queryClient';
import { useAppStore } from '@/store/app-store';
import { listPending, markFailed, markSent } from './outbox';

let flushing = false;
// Si llega un pedido de envío mientras otro está en curso, se repite al terminar.
let flushAgain = false;

const isTransient = (status: number) => status === 0 || status === 401 || status >= 500;

export async function flushOutbox(): Promise<number> {
  const { isOnline, token } = useAppStore.getState();
  if (!isOnline || !token) return 0;
  if (flushing) {
    flushAgain = true;
    return 0;
  }
  flushing = true;

  let syncedCount = 0;
  try {
    const pending = await listPending();
    if (pending.length === 0) return 0;

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
      // Fallos transitorios (sin red, sesión vencida, servidor caído) se reintentan luego
      // y no consumen intentos: si no, los datos pendientes se perderían sin aviso.
      if (error instanceof ApiError && isTransient(error.status)) return 0;
      const message = error instanceof Error ? error.message : 'Error al sincronizar';
      await Promise.all(pending.map((op) => markFailed(op.clientId, message)));
      return 0;
    }

    for (const result of results) {
      if (result.status === 'enviado') {
        await markSent(result.client_id);
        syncedCount += 1;
      } else {
        await markFailed(result.client_id, result.error ?? 'Error al sincronizar');
      }
    }

    queryClient.invalidateQueries({ queryKey: ['favors'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
    queryClient.invalidateQueries({ queryKey: ['outboxPending'] });
    return syncedCount;
  } catch {
    return 0;
  } finally {
    flushing = false;
    if (flushAgain) {
      flushAgain = false;
      void flushOutbox();
    }
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
