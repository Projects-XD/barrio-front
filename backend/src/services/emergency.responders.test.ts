import test from 'node:test';
import assert from 'node:assert/strict';
import { emergencyService } from './emergency.service';
import { clearZoneCache } from './zoneAccess';

// Cliente falso: rpc() devuelve lo que se le indique y recuerda con qué argumentos se llamó.
function fakeRpc(result: { data?: unknown; error?: { code: string; message: string } | null }) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return { data: result.data ?? null, error: result.error ?? null };
    },
  };
  return { client: client as never, calls };
}

const statusOf = (code: number) => (err: unknown) => (err as { statusCode: number }).statusCode === code;
const err = (code: string) => ({ error: { code, message: 'x' } });

test('attendReport envía el id del reporte y del usuario autenticado', async () => {
  const { client, calls } = fakeRpc({ data: [{ report_id: 'r1', responders_count: 2 }] });
  const out = await emergencyService.attendReport(client, 'u1', 'r1');
  assert.deepEqual(out, { report_id: 'r1', responders_count: 2 });
  assert.deepEqual(calls, [{ fn: 'fn_atender_reporte', args: { p_report_id: 'r1', p_user_id: 'u1' } }]);
});

test('attendReport traduce los errores de la base a HTTP', async () => {
  await assert.rejects(emergencyService.attendReport(fakeRpc(err('P0002')).client, 'u', 'r'), statusOf(404));
  await assert.rejects(emergencyService.attendReport(fakeRpc(err('42501')).client, 'u', 'r'), statusOf(403));
  await assert.rejects(emergencyService.attendReport(fakeRpc({ data: [] }).client, 'u', 'r'), statusOf(404));
});

test('requestBackup traduce no encontrado, no voluntario y límite de tiempo', async () => {
  const ok = fakeRpc({ data: [{ report_id: 'r1', responders_count: 1 }] });
  assert.equal((await emergencyService.requestBackup(ok.client, 'u1', 'r1')).responders_count, 1);
  assert.equal(ok.calls[0]?.fn, 'fn_pedir_refuerzo');
  await assert.rejects(emergencyService.requestBackup(fakeRpc(err('P0002')).client, 'u', 'r'), statusOf(404));
  await assert.rejects(emergencyService.requestBackup(fakeRpc(err('42501')).client, 'u', 'r'), statusOf(403));
  await assert.rejects(emergencyService.requestBackup(fakeRpc(err('54000')).client, 'u', 'r'), statusOf(429));
});

test('releaseReport responde 404 si no estabas acudiendo', async () => {
  assert.deepEqual(await emergencyService.releaseReport(fakeRpc({ data: true }).client, 'u', 'r1'), { id: 'r1' });
  await assert.rejects(emergencyService.releaseReport(fakeRpc({ data: false }).client, 'u', 'r1'), statusOf(404));
});

// --- Privacidad de nombre y dirección exacta en el listado ---
function fakeList(opts: { committee?: boolean }, reports: Record<string, unknown>[]) {
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gt', 'order']) builder[m] = () => builder;
  builder.range = async () => ({ data: reports, error: null, count: reports.length });
  builder.maybeSingle = async () => ({
    data: { zone_id: 'z1', is_admin: false, emergency_role: Boolean(opts.committee) },
    error: null,
  });
  return { from: () => builder } as never;
}

const reporte = (extra: Record<string, unknown> = {}) => ({
  id: 'r1',
  reporter_user_id: 'reporter',
  is_anonymous: false,
  affected_name: 'Doña Rosa',
  location_detail: 'Jr. Lima 123, casa azul',
  responders: [{ user_id: 'voluntario' }],
  ...extra,
});

async function listarComo(userId: string, opts: { committee?: boolean } = {}, extra = {}) {
  clearZoneCache();
  const out = await emergencyService.listReports(fakeList(opts, [reporte(extra)]), userId);
  return out.items[0] as Record<string, unknown>;
}

test('un vecino cualquiera no recibe nombre ni dirección, solo que existen', async () => {
  const r = await listarComo('desconocido');
  assert.equal(r.affected_name, undefined);
  assert.equal(r.location_detail, undefined);
  assert.equal(r.detail_hidden, true);
});

test('reportante, voluntario y comité sí reciben nombre y dirección', async () => {
  for (const [user, opts] of [['reporter', {}], ['voluntario', {}], ['otro', { committee: true }]] as const) {
    const r = await listarComo(user, opts);
    assert.equal(r.affected_name, 'Doña Rosa', user);
    assert.equal(r.location_detail, 'Jr. Lima 123, casa azul', user);
    assert.equal(r.detail_hidden, undefined, user);
  }
});

test('un reporte anónimo oculta al reportante aunque se vean los detalles', async () => {
  const r = await listarComo('voluntario', {}, { is_anonymous: true });
  assert.equal(r.reporter_user_id, undefined);
  assert.equal(r.location_detail, 'Jr. Lima 123, casa azul');
});

test('un reporte sin nombre ni dirección no marca detail_hidden', async () => {
  const r = await listarComo('desconocido', {}, { affected_name: null, location_detail: null });
  assert.equal(r.detail_hidden, false);
});

// --- Cerrar reportes y límite de envío ---
test('el listado marca is_mine aunque el reporte sea anónimo', async () => {
  const mio = await listarComo('reporter', {}, { is_anonymous: true });
  assert.equal(mio.is_mine, true);
  assert.equal(mio.reporter_user_id, undefined);
  assert.equal((await listarComo('desconocido')).is_mine, false);
});

// Cliente falso para resolveReport: registra los filtros .eq() del UPDATE y devuelve `updated`.
function fakeResolve(opts: { committee: boolean; updated: unknown }) {
  const filtros: string[] = [];
  const users: Record<string, unknown> = {};
  for (const m of ['select', 'eq']) users[m] = () => users;
  users.maybeSingle = async () => ({
    data: { zone_id: 'z1', is_admin: false, emergency_role: opts.committee },
    error: null,
  });
  const reports: Record<string, unknown> = {};
  reports.update = () => reports;
  reports.eq = (col: string, val: unknown) => (filtros.push(`${col}=${val}`), reports);
  reports.select = () => reports;
  reports.maybeSingle = async () => ({ data: opts.updated, error: null });
  const client = { from: (t: string) => (t === 'users' ? users : reports) } as never;
  return { client, filtros };
}

test('quien reportó solo puede cerrar su propio reporte; el comité cualquiera de la zona', async () => {
  clearZoneCache();
  const vecino = fakeResolve({ committee: false, updated: { id: 'r1', status: 'resuelto' } });
  await emergencyService.resolveReport(vecino.client, 'reporter', 'r1');
  assert.ok(vecino.filtros.includes('reporter_user_id=reporter'));

  clearZoneCache();
  const comite = fakeResolve({ committee: true, updated: { id: 'r1', status: 'resuelto' } });
  await emergencyService.resolveReport(comite.client, 'comite', 'r1');
  assert.ok(!comite.filtros.some((f) => f.startsWith('reporter_user_id=')));
});

test('cerrar un reporte ajeno sin ser comité responde 404', async () => {
  clearZoneCache();
  const { client } = fakeResolve({ committee: false, updated: null });
  await assert.rejects(emergencyService.resolveReport(client, 'curioso', 'r1'), statusOf(404));
});

test('crear demasiados reportes seguidos responde 429', async () => {
  clearZoneCache();
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'insert']) builder[m] = () => builder;
  builder.maybeSingle = async () => ({ data: { zone_id: 'z1' }, error: null });
  builder.single = async () => ({ data: null, error: { code: '54000', message: 'Enviaste demasiados reportes' } });
  await assert.rejects(
    emergencyService.createReport({ from: () => builder } as never, 'u1', { description: 'x'.repeat(10), needs: [], is_anonymous: false }),
    statusOf(429)
  );
});
