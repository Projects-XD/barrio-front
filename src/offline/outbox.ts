import { getDb } from './db';

export const MAX_ATTEMPTS = 5;

export type OutboxOperation = 'create_favor';

export type OutboxItem = {
  clientId: string;
  operation: OutboxOperation;
  payload: unknown;
  attempts: number;
};

type OutboxRow = {
  client_id: string;
  operation: OutboxOperation;
  payload: string;
  attempts: number;
};

export async function enqueue(clientId: string, operation: OutboxOperation, payload: unknown) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO outbox (client_id, operation, payload, created_at) VALUES (?, ?, ?, ?)',
    clientId,
    operation,
    JSON.stringify(payload),
    new Date().toISOString(),
  );
}

export async function listPending(): Promise<OutboxItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT client_id, operation, payload, attempts
       FROM outbox
      WHERE status != 'enviado' AND attempts < ?
      ORDER BY created_at ASC`,
    MAX_ATTEMPTS,
  );
  return rows.map((r) => ({
    clientId: r.client_id,
    operation: r.operation,
    payload: JSON.parse(r.payload),
    attempts: r.attempts,
  }));
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
