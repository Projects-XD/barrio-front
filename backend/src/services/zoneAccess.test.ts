import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { clearZoneCache, resolveUserZone } from './zoneAccess';

// Cliente falso que cuenta cuantas veces se consulta public.users.
function fakeSupabase(zoneId: string | null) {
  let calls = 0;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            calls += 1;
            return { data: zoneId ? { zone_id: zoneId } : null, error: null };
          },
        }),
      }),
    }),
  };
  return { client: client as never, calls: () => calls };
}

const statusOf = (code: number) => (err: unknown) => (err as { statusCode: number }).statusCode === code;

beforeEach(() => clearZoneCache());

test('devuelve la zona del usuario y la reutiliza sin volver a consultar', async () => {
  const { client, calls } = fakeSupabase('z1');
  assert.equal(await resolveUserZone(client, 'u1'), 'z1');
  assert.equal(await resolveUserZone(client, 'u1'), 'z1');
  assert.equal(calls(), 1);
});

test('cada usuario tiene su propia zona en memoria', async () => {
  const { client, calls } = fakeSupabase('z1');
  await resolveUserZone(client, 'u1');
  await resolveUserZone(client, 'u2');
  assert.equal(calls(), 2);
});

test('pedir otra zona da 403 aunque la zona real venga de memoria', async () => {
  const { client } = fakeSupabase('z1');
  await resolveUserZone(client, 'u1');
  await assert.rejects(resolveUserZone(client, 'u1', 'otra'), statusOf(403));
});

test('un usuario sin zona da 403 y no se guarda en memoria', async () => {
  const { client, calls } = fakeSupabase(null);
  await assert.rejects(resolveUserZone(client, 'u1'), statusOf(403));
  await assert.rejects(resolveUserZone(client, 'u1'), statusOf(403));
  assert.equal(calls(), 2);
});
