import { createHash } from 'node:crypto';

type AuthResult = { data: { user: unknown | null }; error: unknown | null };

function jwtExpiryMs(token: string): number {
  try {
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
    return typeof exp === 'number' ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/**
 * Evita un viaje a Supabase Auth por cada petición: el mismo token se verifica una vez cada `ttlMs`
 * y las peticiones simultáneas comparten esa verificación.
 * Solo se conservan los tokens válidos y nunca más allá de su exp. Costo: un token revocado
 * sigue aceptándose hasta `ttlMs`.
 */
export function createAuthCache<R extends AuthResult>(
  verify: (token: string) => Promise<R>,
  ttlMs: number,
  maxEntries = 5_000
) {
  const entries = new Map<string, { expiresAt: number; result: Promise<R> }>();

  return (token: string): Promise<R> => {
    const key = createHash('sha256').update(token).digest('hex');
    const now = Date.now();
    const hit = entries.get(key);
    if (hit && hit.expiresAt > now) return hit.result;

    const result = verify(token);
    // ponytail: vaciado total al llenarse; basta con un solo proceso. LRU si crece el tráfico.
    if (entries.size >= maxEntries) entries.clear();
    entries.set(key, { expiresAt: Math.min(now + ttlMs, jwtExpiryMs(token)), result });

    const forget = () => entries.delete(key);
    result.then((r) => {
      if (r.error || !r.data.user) forget();
    }, forget);

    return result;
  };
}
