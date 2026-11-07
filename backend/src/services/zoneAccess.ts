import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../middlewares/errorHandler';

/**
 * Devuelve la zona del usuario según public.users, la única fuente confiable:
 * la metadata de Auth la puede editar el propio usuario.
 * Responde 403 si no tiene zona o si pidió una zona distinta a la suya.
 */
// La zona de un vecino casi no cambia y se pide en cada peticion (el chat consulta cada 4 s).
// Se guarda en memoria unos segundos para no repetir la misma consulta a public.users.
const ZONE_TTL_MS = 60_000;
const zoneCache = new Map<string, { zoneId: string; expiresAt: number }>();

export function clearZoneCache(): void {
  zoneCache.clear();
}

export async function resolveUserZone(
  supabase: SupabaseClient<Database>,
  userId: string,
  requestedZoneId?: string | null
): Promise<string> {
  const cached = zoneCache.get(userId);
  let zoneId: string | null = cached && cached.expiresAt > Date.now() ? cached.zoneId : null;

  if (!zoneId) {
    const { data: user, error } = await supabase
      .from('users')
      .select('zone_id')
      .eq('id', userId)
      .maybeSingle();

    if (error || !user?.zone_id) {
      zoneCache.delete(userId);
      throw new AppError('Debes pertenecer a una zona vecinal registrada', 403);
    }

    zoneId = user.zone_id;
    zoneCache.set(userId, { zoneId, expiresAt: Date.now() + ZONE_TTL_MS });
  }

  if (requestedZoneId && requestedZoneId !== zoneId) {
    throw new AppError('Acceso denegado: la zona solicitada no es la tuya', 403);
  }

  return zoneId;
}

/**
 * Exige que un perfil profesional pertenezca a la zona del usuario.
 */
export async function assertProfileInUserZone(
  supabase: SupabaseClient<Database>,
  userId: string,
  profileId: string
): Promise<void> {
  const userZoneId = await resolveUserZone(supabase, userId);

  const { data: profile, error } = await supabase
    .from('professional_profiles')
    .select('zone_id')
    .eq('id', profileId)
    .maybeSingle();

  if (error || !profile) {
    throw new AppError('Perfil profesional objetivo no encontrado', 404);
  }

  if (profile.zone_id !== userZoneId) {
    throw new AppError(
      'Acceso denegado: solo los vecinos de la misma zona del perfil pueden otorgar un visto bueno',
      403
    );
  }
}
