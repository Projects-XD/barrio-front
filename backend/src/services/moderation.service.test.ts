// Ejecutar con: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ModerationService } from './moderation.service';

// Imita lo justo del cliente de Supabase: responde por tabla y anota los filtros .eq().
function fakeSupabase(answers: Record<string, unknown>) {
  const filters: [string, unknown][] = [];
  const from = (table: string) => {
    const chain: any = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            return (resolve: (r: unknown) => void) => resolve({ data: answers[table], error: null });
          }
          return (column: string, value: unknown) => {
            if (prop === 'eq') filters.push([column, value]);
            return chain;
          };
        },
      }
    );
    return chain;
  };
  return { client: { from } as any, filters };
}

const service = new ModerationService();
const page = { limit: 20, offset: 0 };
const row = {
  id: 'r1',
  target_id: 't1',
  reason: 'acoso',
  details: null,
  users: { id: 'u1', full_name: 'Ana', zone_id: 'z1' },
};

test('los reportes se limitan a la zona del admin y traen los nombres sin exponer la zona', async () => {
  const { client, filters } = fakeSupabase({
    user_reports: [row],
    users: [{ id: 't1', full_name: 'Luis' }],
  });

  const report = (await service.listReports(client, 'z1', page))[0]!;

  assert.deepEqual(filters, [
    ['users.zone_id', 'z1'],
    ['target_type', 'user'],
  ]);
  assert.deepEqual(report.reporter, { id: 'u1', full_name: 'Ana' });
  assert.deepEqual(report.target, { id: 't1', full_name: 'Luis' });
  assert.equal('users' in report, false);
});

test('un reportado que ya no existe deja target en null', async () => {
  const { client } = fakeSupabase({ user_reports: [row], users: [] });
  const report = (await service.listReports(client, 'z1', page))[0]!;
  assert.equal(report.target, null);
});

test('sin reportes no consulta usuarios', async () => {
  const { client } = fakeSupabase({
    user_reports: [],
    get users() {
      throw new Error('no debería consultar users');
    },
  });
  assert.deepEqual(await service.listReports(client, 'z1', page), []);
});
