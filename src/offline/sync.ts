import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { ApiError } from '@/api/client';
import { sendSyncBatch } from '@/api/endpoints';
import { queryClient } from '@/lib/queryClient';
import { useAppStore } from '@/store/app-store';
import { logger } from '@/utils/logger';
import { listPending, markFailed, markSent } from './outbox';

const BATCH_SIZE = 50;
let flushing = false;
// Si llega un pedido de envío mientras otro está en curso, se repite al terminar.
let flushAgain = false;

// 408 (tiempo agotado), 425 (muy pronto) y 429 (limite de peticiones) tambien se reintentan: no son culpa de los datos.
const TRANSIENT_STATUSES = new Set([0, 401, 408, 425, 429]);
const isTransient = (status: number) => TRANSIENT_STATUSES.has(status) || status >= 500;

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

    // Bloques de BATCH_SIZE: el backend rechaza lotes muy grandes y asi un fallo no afecta a todo.
    for (let from = 0; from < pending.length; from += BATCH_SIZE) {
      const chunk = pending.slice(from, from + BATCH_SIZE);
      let results;
      try {
        const response = await sendSyncBatch(
          chunk.map((op) => ({
            client_id: op.clientId,
            operation: op.operation,
            payload: op.payload,
          })),
        );
        results = response.results;
      } catch (error) {
        // Fallos transitorios (sin red, sesion vencida, limite de peticiones, servidor caido) se
        // reintentan luego y no consumen intentos: si no, los datos pendientes se perderian sin aviso.
        if (error instanceof ApiError && isTransient(error.status)) break;
        const message = error instanceof Error ? error.message : 'Error al sincronizar';
        await Promise.all(chunk.map((op) => markFailed(op.clientId, message)));
        continue;
      }

      for (const result of results) {
        if (result.status === 'enviado') {
          await markSent(result.client_id);
          syncedCount += 1;
        } else {
          await markFailed(result.client_id, result.error ?? 'Error al sincronizar');
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ['favors'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
    queryClient.invalidateQueries({ queryKey: ['outboxPending'] });
    return syncedCount;
  } catch (error) {
    logger.warn('OFFLINE_SYNC', 'Fallo inesperado al sincronizar la cola', error);
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
