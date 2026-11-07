// Ejecutar con: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FavorService } from './favor.service';
import { ModerationService } from './moderation.service';
import { SyncService } from './sync.service';
import { createFavorSchema } from '../utils/validators';

const HOUR = 60 * 60 * 1000;
const hoursAgo = (h: number) => new Date(Date.now() - h * HOUR).toISOString();

// Imita lo justo del cliente de Supabase: toda consulta devuelve `row` y se anotan las escrituras.
// `answer` permite variar la respuesta según la tabla y si la consulta es una escritura.
function fakeSupabase(
  row: Record<string, unknown>,
  answer: (table: string, isWrite: boolean) => Record<string, unknown> | null = () => row
) {
  const writes: { table: string; op: string; values: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    let isWrite = false;
    const chain: any = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            return (resolve: (r: unknown) => void) => resolve({ data: answer(table, isWrite), error: null });
          }
          return (values: Record<string, unknown>) => {
            if (prop === 'update' || prop === 'insert') {
              isWrite = true;
              writes.push({ table, op: prop, values });
            }
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
const moderation = new ModerationService();
const AUTHOR = 'author-id';
const ADMIN = 'admin-id';
const baseFavor = {
  id: 'f1',
  author_id: AUTHOR,
  zone_id: 'z1',
  status: 'abierta',
  closed_at: null,
  deleted_at: null,
  urgency: 'normal',
  moderation_status: 'aprobado',
};
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

test('getFavorById oculta el contenido a otros vecinos si el favor fue retirado por reportes', async () => {
  const row = { ...baseFavor, title: 'Secreto', description: 'Texto', moderation_status: 'rechazado', created_at: hoursAgo(1) };
  const asNeighbor = await service.getFavorById(fakeSupabase(row).client, 'neighbor-id', 'f1');
  assert.equal(asNeighbor.is_deactivated, true);
  assert.equal(asNeighbor.title, '');
  assert.equal(asNeighbor.description, null);
  const asAuthor = await service.getFavorById(fakeSupabase(row).client, AUTHOR, 'f1');
  assert.equal(asAuthor.title, 'Secreto');
});

test('getFavorById no expone quienes estan interesados, solo el conteo y el interes propio', async () => {
  const interests = [
    { id: 'i1', user_id: 'neighbor-id', user: { id: 'neighbor-id', full_name: 'Yo' } },
    { id: 'i2', user_id: 'otro', user: { id: 'otro', full_name: 'Otro vecino' } },
  ];
  const row = { ...baseFavor, interests, created_at: hoursAgo(1) };
  const asNeighbor = await service.getFavorById(fakeSupabase(row).client, 'neighbor-id', 'f1');
  assert.equal(asNeighbor.interested_count, 2);
  assert.deepEqual(asNeighbor.interests.map((i) => i.user_id), ['neighbor-id']);
  const asAuthor = await service.getFavorById(fakeSupabase(row).client, AUTHOR, 'f1');
  assert.equal(asAuthor.interests.length, 2);
});

test('getFavorById indica can_edit según la ventana', async () => {
  const fresh = await service.getFavorById(fakeSupabase({ ...baseFavor, created_at: hoursAgo(1) }).client, AUTHOR, 'f1');
  assert.equal(fresh.can_edit, true);
  const old = await service.getFavorById(fakeSupabase({ ...baseFavor, created_at: hoursAgo(25) }).client, AUTHOR, 'f1');
  assert.equal(old.can_edit, false);
});

// ---------- Urgencia y moderación ----------

// Simula un favor nuevo: no hay duplicado por client_id, pero la zona del usuario sí responde.
const newFavorSupabase = () =>
  fakeSupabase(baseFavor, (table, isWrite) => (table === 'favors' && !isWrite ? null : baseFavor));
const favorInsert = (writes: ReturnType<typeof fakeSupabase>['writes']) =>
  writes.find((w) => w.table === 'favors' && w.op === 'insert')?.values;
const CLIENT_ID = 'c0a80101-1234-4567-89ab-01a1b442bf73';
const favorBody = { client_id: CLIENT_ID, type: 'herramienta', title: 'Taladro' };

// Desde af99f25 no hay revisión previa: el favor se publica aprobado y se oculta por reportes de vecinos.
test('createFavor sin urgency queda normal y aprobado', async () => {
  const { client, writes } = newFavorSupabase();
  await service.createFavor(client, AUTHOR, createFavorSchema.parse(favorBody));
  assert.equal(favorInsert(writes)?.urgency, 'normal');
  assert.equal(favorInsert(writes)?.moderation_status, 'aprobado');
});

for (const urgency of ['urgente', 'emergencia']) {
  test(`createFavor ${urgency} queda aprobado`, async () => {
    const { client, writes } = newFavorSupabase();
    await service.createFavor(client, AUTHOR, createFavorSchema.parse({ ...favorBody, urgency }));
    assert.equal(favorInsert(writes)?.moderation_status, 'aprobado');
  });
}

test('createFavor ignora un moderation_status enviado por el cliente', async () => {
  const { client, writes } = newFavorSupabase();
  const dto = createFavorSchema.parse({ ...favorBody, urgency: 'emergencia', moderation_status: 'rechazado' });
  await service.createFavor(client, AUTHOR, dto);
  assert.equal(favorInsert(writes)?.moderation_status, 'aprobado');
});

test('reintentar con el mismo client_id no vuelve a encolar', async () => {
  const { client, writes } = fakeSupabase({ ...baseFavor, urgency: 'urgente', moderation_status: 'aprobado' });
  const favor = await service.createFavor(client, AUTHOR, createFavorSchema.parse({ ...favorBody, urgency: 'urgente' }));
  assert.equal(favor.moderation_status, 'aprobado');
  assert.equal(writes.length, 0);
});

test('sync create_favor aplica la misma moderación, y sin urgency queda normal', async () => {
  const run = async (payload: Record<string, unknown>) => {
    const { client, writes } = newFavorSupabase();
    const [result] = await new SyncService().processSyncBatch(client, AUTHOR, [
      { client_id: CLIENT_ID, operation: 'create_favor', payload },
    ]);
    assert.equal(result?.status, 'enviado');
    return favorInsert(writes);
  };
  const { client_id: _clientId, ...payload } = favorBody;
  assert.equal((await run({ ...payload, urgency: 'emergencia' }))?.moderation_status, 'aprobado');
  const sinUrgencia = await run(payload);
  assert.equal(sinUrgencia?.urgency, 'normal');
  assert.equal(sinUrgencia?.moderation_status, 'aprobado');
});

test('editar el contenido de un urgente aprobado no toca la moderación', async () => {
  const { client, writes } = fakeSupabase({ ...baseFavor, urgency: 'urgente', moderation_status: 'aprobado', created_at: hoursAgo(1) });
  await service.updateFavor(client, AUTHOR, 'f1', { title: 'Otro texto' });
  assert.equal('moderation_status' in writes[0]!.values, false);
  assert.equal('moderated_by' in writes[0]!.values, false);
});

test('editar el contenido de un normal aprobado tampoco toca la moderación', async () => {
  const { client, writes } = fakeSupabase({ ...baseFavor, moderation_status: 'aprobado', created_at: hoursAgo(1) });
  await service.updateFavor(client, AUTHOR, 'f1', { title: 'Otro texto' });
  assert.equal('moderation_status' in writes[0]!.values, false);
  assert.equal('moderated_by' in writes[0]!.values, false);
});

// ---------- Reportes de vecinos ----------

// Dos vecinos ya reportaron el favor; `closed` son sus favores cerrados, una fila por favor.
function reportSupabase(closed: { author_id: string }[]) {
  let favorReads = 0;
  let reportReads = 0;
  const reportable = { ...baseFavor, moderation_status: 'aprobado' };
  const { client, writes } = fakeSupabase(baseFavor, (table, isWrite) => {
    if (isWrite) return baseFavor;
    if (table === 'favors') return ++favorReads === 1 ? reportable : (closed as unknown as Record<string, unknown>);
    if (table === 'user_reports') {
      return ++reportReads === 1
        ? null
        : ([{ reporter_user_id: 'r1' }, { reporter_user_id: 'r2' }] as unknown as Record<string, unknown>);
    }
    return baseFavor; // resolveUserZone: misma zona que el favor
  });
  return { client, writes, favorReads: () => favorReads };
}

test('reportFavor oculta al llegar a 3 puntos y consulta la reputación una sola vez', async () => {
  const closed = [{ author_id: 'r1' }, { author_id: 'r1' }, { author_id: 'r1' }];
  const { client, writes, favorReads } = reportSupabase(closed);
  const result = await service.reportFavor(client, 'r2', 'f1', 'Es spam');
  assert.equal(result.hidden, true);
  assert.equal(writes.find((w) => w.table === 'favors' && w.op === 'update')?.values.moderation_status, 'rechazado');
  assert.equal(favorReads(), 2); // el favor y la reputación de todos los que reportaron
});

test('reportFavor no oculta si nadie llega a vecino de confianza', async () => {
  const closed = [{ author_id: 'r1' }, { author_id: 'r1' }, { author_id: 'r2' }];
  const { client, writes } = reportSupabase(closed);
  const result = await service.reportFavor(client, 'r2', 'f1', 'Es spam');
  assert.equal(result.hidden, false);
  assert.equal(writes.some((w) => w.table === 'favors' && w.op === 'update'), false);
});

test('cerrar un favor no toca la moderación', async () => {
  const urgent = fakeSupabase({ ...baseFavor, urgency: 'urgente', created_at: hoursAgo(1) });
  await service.updateFavor(urgent.client, AUTHOR, 'f1', { status: 'cerrada' });
  assert.equal('moderation_status' in urgent.writes[0]!.values, false);
});

test('getFavorById no revela el motivo de rechazo a otros vecinos, pero sí a su autor', async () => {
  const row = { ...baseFavor, status: 'cancelada', deleted_at: hoursAgo(1), created_at: hoursAgo(2), moderated_by: ADMIN, moderation_reason: 'Motivo' };
  const asNeighbor = await service.getFavorById(fakeSupabase(row).client, 'neighbor-id', 'f1');
  assert.equal(asNeighbor.moderation_reason, null);
  assert.equal(asNeighbor.moderated_by, null);
  const asAuthor = await service.getFavorById(fakeSupabase(row).client, AUTHOR, 'f1');
  assert.equal(asAuthor.moderation_reason, 'Motivo');
});

test('aprobar registra al admin y no toca el estado del favor', async () => {
  const { client, writes } = fakeSupabase(baseFavor);
  await moderation.approve(client, ADMIN, 'z1', 'f1');
  const update = writes.find((w) => w.op === 'update')!.values;
  assert.equal(update.moderation_status, 'aprobado');
  assert.equal(update.moderated_by, ADMIN);
  assert.ok(update.moderated_at);
  assert.equal('status' in update, false);
  assert.equal(writes.some((w) => w.table === 'favor_events'), false);
});

test('rechazar usa soft-delete, guarda el motivo y registra el evento', async () => {
  const { client, writes } = fakeSupabase({ ...baseFavor, status: 'en_curso' });
  await moderation.reject(client, ADMIN, 'z1', 'f1', 'Datos falsos');
  const update = writes.find((w) => w.op === 'update')!.values;
  assert.equal(update.moderation_status, 'rechazado');
  assert.equal(update.moderation_reason, 'Datos falsos');
  assert.equal(update.status, 'cancelada');
  assert.ok(update.deleted_at);
  const event = writes.find((w) => w.table === 'favor_events')!.values;
  assert.equal(event.from_status, 'en_curso');
  assert.equal(event.to_status, 'cancelada');
});

test('un admin no puede moderar sus propios favores', async () => {
  const { client, writes } = fakeSupabase({ ...baseFavor, author_id: ADMIN });
  await assert.rejects(moderation.approve(client, ADMIN, 'z1', 'f1'), rejectsWith(403));
  assert.equal(writes.length, 0);
});

test('un admin no puede moderar favores de otra zona', async () => {
  const { client, writes } = fakeSupabase(baseFavor);
  await assert.rejects(moderation.reject(client, ADMIN, 'otra-zona', 'f1', 'Motivo'), rejectsWith(403));
  assert.equal(writes.length, 0);
});

test('si otro admin ya decidió responde 409 y no registra evento', async () => {
  const { client, writes } = fakeSupabase(baseFavor, (_table, isWrite) => (isWrite ? null : baseFavor));
  await assert.rejects(moderation.reject(client, ADMIN, 'z1', 'f1', 'Motivo'), rejectsWith(409));
  assert.equal(writes.some((w) => w.table === 'favor_events'), false);
});
