import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAuthCache } from './authCache';

const tokenWithExp = (expSeconds: number) =>
  `h.${Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url')}.s`;
const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;
const valid = { data: { user: { id: 'u1' } }, error: null };

function counting(answer: () => Promise<typeof valid | { data: { user: null }; error: string }>) {
  const calls = { n: 0 };
  return { calls, verify: () => (calls.n++, answer()) };
}

test('un token válido se verifica una sola vez, incluso con peticiones simultáneas', async () => {
  const { calls, verify } = counting(async () => valid);
  const cached = createAuthCache(verify, 30_000);
  const token = tokenWithExp(inOneHour());
  await Promise.all([cached(token), cached(token)]);
  await cached(token);
  assert.equal(calls.n, 1);
});

test('tokens distintos no comparten usuario', async () => {
  const { calls, verify } = counting(async () => valid);
  const cached = createAuthCache(verify, 30_000);
  await cached(tokenWithExp(inOneHour()));
  await cached(tokenWithExp(inOneHour() + 1));
  assert.equal(calls.n, 2);
});

test('un token rechazado no se conserva', async () => {
  const { calls, verify } = counting(async () => ({ data: { user: null }, error: 'invalid' }));
  const cached = createAuthCache(verify, 30_000);
  const token = tokenWithExp(inOneHour());
  await cached(token);
  await new Promise((resolve) => setImmediate(resolve));
  await cached(token);
  assert.equal(calls.n, 2);
});

test('un fallo de red no se conserva', async () => {
  const { calls, verify } = counting(async () => {
    throw new Error('red');
  });
  const cached = createAuthCache(verify, 30_000);
  const token = tokenWithExp(inOneHour());
  await assert.rejects(cached(token));
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(cached(token));
  assert.equal(calls.n, 2);
});

test('un token vencido o sin exp se vuelve a verificar', async () => {
  const { calls, verify } = counting(async () => valid);
  const cached = createAuthCache(verify, 30_000);
  const expired = tokenWithExp(Math.floor(Date.now() / 1000) - 10);
  await cached(expired);
  await cached(expired);
  await cached('no-es-un-jwt');
  await cached('no-es-un-jwt');
  assert.equal(calls.n, 4);
});

test('pasado el TTL se vuelve a verificar', async () => {
  const { calls, verify } = counting(async () => valid);
  const cached = createAuthCache(verify, 5);
  const token = tokenWithExp(inOneHour());
  await cached(token);
  await new Promise((resolve) => setTimeout(resolve, 15));
  await cached(token);
  assert.equal(calls.n, 2);
});
