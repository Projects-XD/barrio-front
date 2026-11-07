import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('barrio.db').then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS outbox (
          client_id TEXT PRIMARY KEY NOT NULL,
          operation TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pendiente',
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL,
          user_id TEXT
        );
      `);
      // Bases creadas antes de existir user_id: se agrega la columna si falta.
      // Esas filas quedan sin dueño y no se envían (no se sabe a qué vecino pertenecen).
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(outbox)');
      if (!columns.some((c) => c.name === 'user_id')) {
        await db.execAsync('ALTER TABLE outbox ADD COLUMN user_id TEXT');
      }
      return db;
    });
  }
  return dbPromise;
}
