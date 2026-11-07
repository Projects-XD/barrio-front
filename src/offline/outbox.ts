import { Platform } from 'react-native';
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
  status?: string;
  attempts: number;
  created_at: string;
  user_id?: string;
};

const WEB_STORAGE_KEY = 'barrio_outbox_v1';
let memoryFallbackRows: OutboxRow[] = [];

function readFallbackRows(): OutboxRow[] {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(WEB_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as OutboxRow[];
    } catch {
      // Fallback a memoria
    }
  }
  return memoryFallbackRows;
}

function writeFallbackRows(rows: OutboxRow[]) {
  memoryFallbackRows = rows;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(rows));
    } catch {
      // Ignorar si localStorage está bloqueado
    }
  }
}

export async function enqueue(clientId: string, operation: OutboxOperation, payload: Record<string, unknown>) {
  const userId = useAppStore.getState().userId;
  if (!userId) throw new Error('Inicia sesión para guardar datos sin conexión.');
  const now = new Date().toISOString();

  if (Platform.OS !== 'web') {
    try {
      const db = await getDb();
      await db.runAsync(
        'INSERT OR IGNORE INTO outbox (client_id, operation, payload, created_at, user_id) VALUES (?, ?, ?, ?, ?)',
        clientId,
        operation,
        JSON.stringify(payload),
        now,
        userId,
      );
      return;
    } catch {
      // Si SQLite falla en este entorno, usar respaldo en memoria/localStorage
    }
  }

  const rows = readFallbackRows();
  if (!rows.some((r) => r.client_id === clientId)) {
    rows.push({
      client_id: clientId,
      operation,
      payload: JSON.stringify(payload),
      status: 'pendiente',
      attempts: 0,
      created_at: now,
      user_id: userId,
    });
    writeFallbackRows(rows);
  }
}

// Solo devuelve lo del usuario con sesión activa, para no enviar ni mostrar datos de otro vecino.
export async function listPending(operation?: OutboxOperation): Promise<OutboxItem[]> {
  const userId = useAppStore.getState().userId;
  if (!userId) return [];

  if (Platform.OS !== 'web') {
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
      // Continúa al respaldo
    }
  }

  const rows = readFallbackRows().filter(
    (r) =>
      r.status !== 'enviado' &&
      r.attempts < MAX_ATTEMPTS &&
      r.user_id === userId &&
      (!operation || r.operation === operation),
  );
  return rows.map((r) => ({
    clientId: r.client_id,
    operation: r.operation,
    payload: JSON.parse(r.payload) as Record<string, unknown>,
    attempts: r.attempts,
    createdAt: r.created_at,
  }));
}

export async function markSent(clientId: string) {
  if (Platform.OS !== 'web') {
    try {
      const db = await getDb();
      await db.runAsync("UPDATE outbox SET status = 'enviado' WHERE client_id = ?", clientId);
      return;
    } catch {
      // Continúa al respaldo
    }
  }
  const rows = readFallbackRows().map((r) =>
    r.client_id === clientId ? { ...r, status: 'enviado' } : r,
  );
  writeFallbackRows(rows);
}

export async function markFailed(clientId: string, message: string) {
  if (Platform.OS !== 'web') {
    try {
      const db = await getDb();
      await db.runAsync(
        "UPDATE outbox SET status = 'error', attempts = attempts + 1, last_error = ? WHERE client_id = ?",
        message,
        clientId,
      );
      return;
    } catch {
      // Continúa al respaldo
    }
  }
  const rows = readFallbackRows().map((r) =>
    r.client_id === clientId ? { ...r, status: 'error', attempts: r.attempts + 1 } : r,
  );
  writeFallbackRows(rows);
}
