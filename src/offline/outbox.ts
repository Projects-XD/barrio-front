import { useAppStore } from '@/store/app-store';
import { getDb } from './db';

export const MAX_ATTEMPTS = 5;

export type OutboxOperation = 'create_favor' | 'create_vulnerability_report';

export type OutboxItem = {
  clientId: string;
  operation: OutboxOperation;
  payload: Record<string, unknown>;
  attempts: number;
  createdAt: string;
};

type OutboxRow = {
  client_id: string;
  operation: OutboxOperation;
  payload: string;
  attempts: number;
  created_at: string;
};

export async function enqueue(clientId: string, operation: OutboxOperation, payload: Record<string, unknown>) {
  const userId = useAppStore.getState().userId;
  if (!userId) throw new Error('Inicia sesión para guardar datos sin conexión.');
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO outbox (client_id, operation, payload, created_at, user_id) VALUES (?, ?, ?, ?, ?)',
    clientId,
    operation,
    JSON.stringify(payload),
    new Date().toISOString(),
    userId,
  );
}

// Solo devuelve lo del usuario con sesión activa, para no enviar ni mostrar datos de otro vecino.
// Si SQLite no está disponible (por ejemplo en web), se trata como cola vacía.
export async function listPending(operation?: OutboxOperation): Promise<OutboxItem[]> {
  const userId = useAppStore.getState().userId;
  if (!userId) return [];
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<OutboxRow>(
      `SELECT client_id, operation, payload, attempts, created_at
         FROM outbox
        WHERE status != 'enviado' AND attempts < ? AND user_id = ?
        ORDER BY created_at ASC`,
      MAX_ATTEMPTS,
      userId,
    );
    return rows
      .filter((r) => !operation || r.operation === operation)
      .map((r) => ({
        clientId: r.client_id,
        operation: r.operation,
        payload: JSON.parse(r.payload) as Record<string, unknown>,
        attempts: r.attempts,
        createdAt: r.created_at,
      }));
  } catch {
    return [];
  }
}

export async function markSent(clientId: string) {
  const db = await getDb();
  await db.runAsync("UPDATE outbox SET status = 'enviado' WHERE client_id = ?", clientId);
}

export async function markFailed(clientId: string, message: string) {
  const db = await getDb();
  await db.runAsync(
    "UPDATE outbox SET status = 'error', attempts = attempts + 1, last_error = ? WHERE client_id = ?",
    message,
    clientId,
  );
}
