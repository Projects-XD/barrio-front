// Ejecutar con: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FavorService } from './favor.service';

const HOUR = 60 * 60 * 1000;
const hoursAgo = (h: number) => new Date(Date.now() - h * HOUR).toISOString();

// Imita lo justo del cliente de Supabase: toda consulta devuelve `row` y se anotan las escrituras.
function fakeSupabase(row: Record<string, unknown>) {
  const writes: { table: string; op: string; values: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    const chain: any = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            return (resolve: (r: unknown) => void) => resolve({ data: row, error: null });
          }
          return (values: Record<string, unknown>) => {
            if (prop === 'update' || prop === 'insert') writes.push({ table, op: prop, values });
            return chain;
          };
        },
      }
    );
    return chain;
  };
  return { client: { from } as any, writes };
}

const service = new FavorService();
const AUTHOR = 'author-id';
const baseFavor = { id: 'f1', author_id: AUTHOR, zone_id: 'z1', status: 'abierta', closed_at: null, deleted_at: null };
const rejectsWith = (status: number) => (err: unknown) => (err as { statusCode: number }).statusCode === status;

test('editar contenido dentro de las 24 h registra edited_at', async () => {
  const { client, writes } = fakeSupabase({ ...baseFavor, created_at: hoursAgo(23) });
  await service.updateFavor(client, AUTHOR, 'f1', { title: 'Nuevo título' });
  assert.ok(writes[0]?.values.edited_at);
});

test('editar contenido pasadas las 24 h da 403 y no escribe', async () => {
  const { client, writes } = fakeSupabase({ ...baseFavor, created_at: hoursAgo(25) });
  await assert.rejects(service.updateFavor(client, AUTHOR, 'f1', { title: 'Tarde' }), rejectsWith(403));
  assert.equal(writes.length, 0);
});

test('cerrar pasadas las 24 h sí se permite y no cuenta como edición', async () => {
  const { client, writes } = fakeSupabase({ ...baseFavor, created_at: hoursAgo(48) });
  await service.updateFavor(client, AUTHOR, 'f1', { status: 'cerrada' });
  assert.equal(writes[0]?.values.status, 'cerrada');
  assert.equal(writes[0]?.values.edited_at, undefined);
});

test('un favor desactivado no se puede reactivar', async () => {
  const { client, writes } = fakeSupabase({ ...baseFavor, status: 'cancelada', created_at: hoursAgo(1), deleted_at: hoursAgo(1) });
  await assert.rejects(service.updateFavor(client, AUTHOR, 'f1', { status: 'abierta' }), rejectsWith(403));
  assert.equal(writes.length, 0);
});

test('softDeleteFavor marca cancelada y deleted_at, y registra el evento', async () => {
  const { client, writes } = fakeSupabase({ ...baseFavor, created_at: hoursAgo(1) });
  await service.softDeleteFavor(client, AUTHOR, 'f1');
  const update = writes.find((w) => w.op === 'update')!;
  assert.equal(update.values.status, 'cancelada');
  assert.ok(update.values.deleted_at);
  assert.equal(writes.find((w) => w.table === 'favor_events')?.values.to_status, 'cancelada');
});

test('softDeleteFavor es idempotente', async () => {
  const { client, writes } = fakeSupabase({ ...baseFavor, status: 'cancelada', created_at: hoursAgo(1), deleted_at: hoursAgo(1) });
  await service.softDeleteFavor(client, AUTHOR, 'f1');
  assert.equal(writes.length, 0);
});

test('getFavorById oculta el contenido desactivado a otros, pero no a su autor', async () => {
  const row = {
    ...baseFavor,
    status: 'cancelada',
    title: 'Secreto',
    description: 'Texto',
    interests: [{ id: 'i1' }],
    created_at: hoursAgo(1),
    deleted_at: hoursAgo(1),
  };

  const asAuthor = await service.getFavorById(fakeSupabase(row).client, AUTHOR, 'f1');
  assert.equal(asAuthor.is_deactivated, true);
  assert.equal(asAuthor.can_edit, false);
  assert.equal(asAuthor.title, 'Secreto');

  // El stub también responde a resolveUserZone con esta fila: el vecino queda en la misma zona.
  const asNeighbor = await service.getFavorById(fakeSupabase(row).client, 'neighbor-id', 'f1');
  assert.equal(asNeighbor.is_deactivated, true);
  assert.equal(asNeighbor.title, '');
  assert.deepEqual(asNeighbor.interests, []);
});

test('getFavorById indica can_edit según la ventana', async () => {
  const fresh = await service.getFavorById(fakeSupabase({ ...baseFavor, created_at: hoursAgo(1) }).client, AUTHOR, 'f1');
  assert.equal(fresh.can_edit, true);
  const old = await service.getFavorById(fakeSupabase({ ...baseFavor, created_at: hoursAgo(25) }).client, AUTHOR, 'f1');
  assert.equal(old.can_edit, false);
});
