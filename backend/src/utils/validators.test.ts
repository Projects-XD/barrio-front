import test from 'node:test';
import assert from 'node:assert/strict';
import { createFavorSchema, MAX_SYNC_OPERATIONS, syncBatchSchema } from './validators';

const CLIENT_ID = 'c0a80101-1234-4567-89ab-01a1b442bf73';
const base = { client_id: CLIENT_ID, type: 'herramienta', title: 'Necesito un taladro' };

test('un favor sin intent ni urgency queda como pedido normal', () => {
  const dto = createFavorSchema.parse(base);
  assert.equal(dto.intent, 'pedir');
  assert.equal(dto.urgency, 'normal');
});

test('intent solo acepta pedir u ofrecer', () => {
  assert.equal(createFavorSchema.parse({ ...base, intent: 'ofrecer' }).intent, 'ofrecer');
  assert.equal(createFavorSchema.safeParse({ ...base, intent: 'regalar' }).success, false);
});

test('la descripcion de un favor tiene tope de 1000 caracteres', () => {
  assert.equal(createFavorSchema.safeParse({ ...base, description: 'a'.repeat(1000) }).success, true);
  assert.equal(createFavorSchema.safeParse({ ...base, description: 'a'.repeat(1001) }).success, false);
});

const operation = (n: number) => ({
  client_id: `c0a80101-1234-4567-89ab-01a1b442bf${String(n).padStart(2, '0')}`,
  operation: 'create_favor',
  payload: {},
});

test('un lote de sincronizacion admite hasta MAX_SYNC_OPERATIONS operaciones', () => {
  const ok = Array.from({ length: MAX_SYNC_OPERATIONS }, (_, i) => operation(i % 100));
  assert.equal(syncBatchSchema.safeParse(ok).success, true);
  assert.equal(syncBatchSchema.safeParse([...ok, operation(1)]).success, false);
  assert.equal(syncBatchSchema.safeParse({ operations: [...ok, operation(1)] }).success, false);
});
