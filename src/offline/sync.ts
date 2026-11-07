import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { request } from '@/api/client';
import { favorsMock } from '@/data/mock';
import { useAppStore } from '@/store/app-store';
import { listPending, markFailed, markSent, type OutboxItem } from './outbox';

type SyncResult = { clientId: string; status: 'ok' | 'duplicate' | 'error'; message?: string };

async function sendOps(ops: OutboxItem[], token: string | null): Promise<SyncResult[]> {
  if (!process.env.EXPO_PUBLIC_API_URL) {
    return ops.map((o) => ({ clientId: o.clientId, status: 'ok' as const }));
  }
  return request<SyncResult[]>(
    '/sync',
    {
      method: 'POST',
      body: JSON.stringify({
        operations: ops.map((o) => ({ clientId: o.clientId, operation: o.operation, payload: o.payload })),
      }),
    },
    token ?? undefined,
  );
}

function setLocalFavorStatus(clientId: string, status: 'enviado' | 'error') {
  const favor = favorsMock.find((f) => f.id === clientId);
  if (favor) favor.syncStatus = status;
}

export async function flushOutbox() {
  const pending = await listPending();
  if (pending.length === 0) return;

  const { token } = useAppStore.getState();
  let results: SyncResult[];
  try {
    results = await sendOps(pending, token);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de red';
    await Promise.all(pending.map((op) => markFailed(op.clientId, message)));
    pending.forEach((op) => setLocalFavorStatus(op.clientId, 'error'));
    return;
  }

  for (const result of results) {
    if (result.status === 'error') {
      await markFailed(result.clientId, result.message ?? 'Error al sincronizar');
      setLocalFavorStatus(result.clientId, 'error');
    } else {
      await markSent(result.clientId);
      setLocalFavorStatus(result.clientId, 'enviado');
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
      if (state.isOnline && !prev.isOnline) flushOutbox();
    });

    flushOutbox();

    return () => {
      unsubNetInfo();
      unsubStore();
    };
  }, []);
}
