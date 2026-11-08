// Ejecutar con: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConversationService, MESSAGES_PER_MINUTE } from './conversation.service';

type Answer = (table: string, isWrite: boolean) => unknown;

// Imita lo justo del cliente de Supabase: cada consulta devuelve lo que decida `answer` según la tabla
// y se anotan las escrituras. `count` es el total que devuelven las consultas con count exacto.
function fakeSupabase(answer: Answer, count = 0) {
  const writes: { table: string; op: string; values: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    let isWrite = false;
    const chain: any = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            return (resolve: (r: unknown) => void) =>
              resolve({ data: answer(table, isWrite), error: null, count });
          }
          return (values: Record<string, unknown>) => {
            if (prop === 'update' || prop === 'insert' || prop === 'delete') {
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

const service = new ConversationService();
const AUTHOR = 'author-id';
const RESPONDER = 'responder-id';
const OUTSIDER = 'outsider-id';
const conversation = {
  id: 'c1',
  favor_id: 'f1',
  author_id: AUTHOR,
  responder_id: RESPONDER,
  author_muted: false,
  responder_muted: false,
  closed_at: null as string | null,
};
const message = { id: 'm1', conversation_id: 'c1', sender_id: RESPONDER, body: 'Hola', created_at: '2026-01-01T00:00:00Z' };
const rejectsWith = (status: number) => (err: unknown) => (err as { statusCode: number }).statusCode === status;

// Respuesta base: la conversación existe, sin bloqueos ni avisos previos.
const baseAnswer =
  (overrides: Partial<Record<string, unknown>> = {}): Answer =>
  (table, isWrite) => {
    if (table in overrides) return overrides[table];
    if (table === 'conversations') return conversation;
    if (table === 'messages') return isWrite ? message : [];
    if (table === 'user_blocks') return [];
    if (table === 'notifications') return [];
    if (table === 'users') return { full_name: 'María' };
    if (table === 'favors') return { title: 'Prestar escalera' };
    return null;
  };

test('quien no participa en la conversación recibe 404 al leer mensajes', async () => {
  const { client } = fakeSupabase(baseAnswer());
  await assert.rejects(service.listMessages(client, OUTSIDER, 'c1', 50), rejectsWith(404));
});

test('quien no participa no puede enviar mensajes y no se escribe nada', async () => {
  const { client, writes } = fakeSupabase(baseAnswer());
  await assert.rejects(service.sendMessage(client, OUTSIDER, 'c1', { body: 'Hola' }), rejectsWith(404));
  assert.equal(writes.length, 0);
});

test('enviar en una conversación cerrada da 409', async () => {
  const { client, writes } = fakeSupabase(baseAnswer({ conversations: { ...conversation, closed_at: '2026-01-01' } }));
  await assert.rejects(service.sendMessage(client, RESPONDER, 'c1', { body: 'Hola' }), rejectsWith(409));
  assert.equal(writes.length, 0);
});

test('si el otro vecino te bloqueó da 403 sin revelar el bloqueo', async () => {
  const { client, writes } = fakeSupabase(baseAnswer({ user_blocks: [{ blocker_id: AUTHOR }] }));
  await assert.rejects(
    service.sendMessage(client, RESPONDER, 'c1', { body: 'Hola' }),
    (err: unknown) =>
      rejectsWith(403)(err) && !(err as Error).message.toLowerCase().includes('bloque'),
  );
  assert.equal(writes.length, 0);
});

test('si tú bloqueaste al otro vecino da 403', async () => {
  const { client, writes } = fakeSupabase(baseAnswer({ user_blocks: [{ blocker_id: RESPONDER }] }));
  await assert.rejects(service.sendMessage(client, RESPONDER, 'c1', { body: 'Hola' }), rejectsWith(403));
  assert.equal(writes.length, 0);
});

test('pasado el límite de mensajes por minuto da 429 y no escribe', async () => {
  const { client, writes } = fakeSupabase(baseAnswer(), MESSAGES_PER_MINUTE);
  await assert.rejects(service.sendMessage(client, RESPONDER, 'c1', { body: 'Hola' }), rejectsWith(429));
  assert.equal(writes.length, 0);
});

test('enviar un mensaje lo guarda y avisa al otro vecino', async () => {
  const { client, writes } = fakeSupabase(baseAnswer());
  const sent = await service.sendMessage(client, RESPONDER, 'c1', { body: 'Hola' });
  assert.equal(sent.id, 'm1');
  assert.equal(writes.find((w) => w.table === 'messages')?.values.body, 'Hola');
  assert.equal(writes.find((w) => w.table === 'messages')?.values.sender_id, RESPONDER);
  const notification = writes.find((w) => w.table === 'notifications');
  assert.equal(notification?.values.user_id, AUTHOR);
  assert.equal(notification?.values.type, 'nuevo_mensaje');
});

test('si el destinatario silenció la conversación no se crea el aviso', async () => {
  const { client, writes } = fakeSupabase(baseAnswer({ conversations: { ...conversation, author_muted: true } }));
  await service.sendMessage(client, RESPONDER, 'c1', { body: 'Hola' });
  assert.ok(writes.some((w) => w.table === 'messages'));
  assert.equal(writes.some((w) => w.table === 'notifications'), false);
});

test('si ya hay un aviso de mensaje sin leer no se crea otro', async () => {
  const { client, writes } = fakeSupabase(baseAnswer({ notifications: [{ id: 'n1' }] }));
  await service.sendMessage(client, RESPONDER, 'c1', { body: 'Hola' });
  assert.equal(writes.some((w) => w.table === 'notifications'), false);
});

test('silenciar solo cambia la marca de quien lo pide', async () => {
  const { client, writes } = fakeSupabase(baseAnswer());
  await service.updateConversation(client, RESPONDER, 'c1', { muted: true });
  const update = writes.find((w) => w.table === 'conversations' && w.op === 'update');
  assert.deepEqual(update?.values, { responder_muted: true });
});

test('cerrar una conversación ya cerrada da 409 y no escribe', async () => {
  const { client, writes } = fakeSupabase(baseAnswer({ conversations: { ...conversation, closed_at: '2026-01-01' } }));
  await assert.rejects(service.updateConversation(client, AUTHOR, 'c1', { closed: true }), rejectsWith(409));
  assert.equal(writes.length, 0);
});

test('bloquear registra el bloqueo al otro vecino y cierra las conversaciones', async () => {
  const { client, writes } = fakeSupabase(baseAnswer());
  const result = await service.blockOtherUser(client, AUTHOR, 'c1');
  assert.equal(result.blocked_user_id, RESPONDER);
  const block = writes.find((w) => w.table === 'user_blocks');
  assert.deepEqual(block?.values, { blocker_id: AUTHOR, blocked_id: RESPONDER });
  assert.ok(writes.find((w) => w.table === 'conversations' && w.op === 'update')?.values.closed_at);
});

test('desbloquear borra solo el bloqueo propio y reabre las conversaciones', async () => {
  const { client, writes } = fakeSupabase(baseAnswer());
  const result = await service.unblockOtherUser(client, AUTHOR, 'c1');
  assert.equal(result.unblocked_user_id, RESPONDER);
  assert.ok(writes.some((w) => w.table === 'user_blocks' && w.op === 'delete'));
  const reopen = writes.find((w) => w.table === 'conversations' && w.op === 'update');
  assert.deepEqual(reopen?.values, { closed_at: null });
});

test('quien no participa no puede desbloquear y no se escribe nada', async () => {
  const { client, writes } = fakeSupabase(baseAnswer());
  await assert.rejects(service.unblockOtherUser(client, OUTSIDER, 'c1'), rejectsWith(404));
  assert.equal(writes.length, 0);
});

test('getConversation indica si quien consulta bloqueó al otro vecino', async () => {
  const blocked = fakeSupabase(baseAnswer({ user_blocks: { id: 'b1' } }));
  assert.equal((await service.getConversation(blocked.client, AUTHOR, 'c1')).blocked_by_me, true);
  const free = fakeSupabase(baseAnswer({ user_blocks: null }));
  assert.equal((await service.getConversation(free.client, AUTHOR, 'c1')).blocked_by_me, false);
});

test('reportar apunta al otro vecino con el contexto de la conversación', async () => {
  const { client, writes } = fakeSupabase(baseAnswer({ user_reports: { id: 'r1' } }));
  await service.reportOtherUser(client, RESPONDER, 'c1', { reason: 'acoso', details: 'Me insulta' });
  const report = writes.find((w) => w.table === 'user_reports');
  assert.equal(report?.values.reporter_user_id, RESPONDER);
  assert.equal(report?.values.target_id, AUTHOR);
  assert.equal(report?.values.target_type, 'user');
  assert.match(String(report?.values.details), /c1.*Me insulta/);
});
