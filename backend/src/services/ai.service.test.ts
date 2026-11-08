// Ejecutar con: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.SUPABASE_URL ??= 'http://localhost';
process.env.SUPABASE_ANON_KEY ??= 'x';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'x';
process.env.GEMINI_API_KEY = 'test-key';

const geminiReply = (text: string, ok = true) => async () =>
  ({ ok, status: ok ? 200 : 500, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) }) as Response;
const statusOf = (status: number) => (err: unknown) => (err as { statusCode: number }).statusCode === status;

test('devuelve el texto de Gemini y envía la clave en el header, no en la URL', async () => {
  const { AiService } = await import('./ai.service');
  let seen: { url: string; init: RequestInit } | undefined;
  const service = new AiService(async (url, init) => {
    seen = { url: String(url), init: init as RequestInit };
    return geminiReply('Soy gasfitero.')();
  });
  const text = await service.suggestDescription('u1', { category: 'gasfiteria', years_experience: 5, notes: 'arreglo caños' });
  assert.equal(text, 'Soy gasfitero.');
  assert.ok(!seen!.url.includes('test-key'));
  assert.equal((seen!.init.headers as Record<string, string>)['x-goog-api-key'], 'test-key');
  const body = JSON.parse(String(seen!.init.body));
  assert.match(body.contents[0].parts[0].text, /Gasfitería/);
  assert.match(body.contents[0].parts[0].text, /arreglo caños/);
});

test('recorta una sugerencia que pasa del límite de la descripción', async () => {
  const { AiService } = await import('./ai.service');
  const service = new AiService(geminiReply('a'.repeat(900)));
  const text = await service.suggestDescription('u1', { category: 'clases' });
  assert.ok(text.length <= 450);
});

test('pasadas 5 sugerencias en una hora responde 429 sin llamar a Gemini', async () => {
  const { AiService, SUGGESTIONS_PER_HOUR } = await import('./ai.service');
  let calls = 0;
  const service = new AiService(async () => {
    calls++;
    return geminiReply('Hola')();
  });
  for (let i = 0; i < SUGGESTIONS_PER_HOUR; i++) await service.suggestDescription('u1', { category: 'otro' });
  await assert.rejects(service.suggestDescription('u1', { category: 'otro' }), statusOf(429));
  assert.equal(calls, SUGGESTIONS_PER_HOUR);
  // Otro usuario no se ve afectado.
  await service.suggestDescription('u2', { category: 'otro' });
});

test('el límite se libera pasada una hora', async () => {
  const { AiService, SUGGESTIONS_PER_HOUR } = await import('./ai.service');
  let clock = 0;
  const service = new AiService(geminiReply('Hola'), () => clock);
  for (let i = 0; i < SUGGESTIONS_PER_HOUR; i++) await service.suggestDescription('u1', { category: 'otro' });
  clock += 60 * 60 * 1000 + 1;
  assert.equal(await service.suggestDescription('u1', { category: 'otro' }), 'Hola');
});

test('si Gemini falla o no devuelve texto responde 502', async () => {
  const { AiService } = await import('./ai.service');
  await assert.rejects(new AiService(geminiReply('x', false)).suggestDescription('u1', { category: 'otro' }), statusOf(502));
  await assert.rejects(new AiService(geminiReply('  ')).suggestDescription('u1', { category: 'otro' }), statusOf(502));
  await assert.rejects(
    new AiService(async () => {
      throw new Error('red');
    }).suggestDescription('u1', { category: 'otro' }),
    statusOf(502)
  );
});
