import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { logger } from './logger';

const BUCKET = 'chat-images';
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;

/** Ruta dentro del bucket a partir de la URL pública, o null si no es de chat-images. */
function errMsg(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}

export function chatImagePath(url: string): string | null {
  const i = url.indexOf(PUBLIC_MARKER);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + PUBLIC_MARKER.length).split('?')[0] ?? '');
}

/**
 * Borra de Storage las imágenes de los chats cerrados y las quita de la BD:
 * los mensajes que eran solo imagen se eliminan; en los demás se conserva el texto.
 * Es "mejor esfuerzo": si falla, el cierre del chat no debe fallar (se reintenta al volver a cerrar).
 * Requiere un cliente con service_role (los usuarios no pueden borrar mensajes ni archivos ajenos).
 */
export async function purgeChatImages(admin: SupabaseClient<Database>, conversationIds: string[]): Promise<void> {
  if (conversationIds.length === 0) return;
  try {
    const { data: rows, error } = await admin
      .from('messages')
      .select('id, body, images')
      .in('conversation_id', conversationIds)
      .not('images', 'eq', '{}');
    if (error) throw error;
    logger.info('Borrando imágenes de chat cerrado', { conversationIds, mensajesConImagen: rows?.length ?? 0 });
    if (!rows || rows.length === 0) return;

    const paths = rows.flatMap((m) => m.images).map(chatImagePath).filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      const { error: removeError } = await admin.storage.from(BUCKET).remove(paths);
      if (removeError) throw removeError;
    }

    const soloImagen = rows.filter((m) => m.body.trim() === '').map((m) => m.id);
    const conTexto = rows.filter((m) => m.body.trim() !== '').map((m) => m.id);
    if (soloImagen.length > 0) {
      const { error: delError } = await admin.from('messages').delete().in('id', soloImagen);
      if (delError) throw delError;
    }
    if (conTexto.length > 0) {
      const { error: updError } = await admin.from('messages').update({ images: [] }).in('id', conTexto);
      if (updError) throw updError;
    }
  } catch (err) {
    logger.error('No se pudieron borrar las imágenes del chat cerrado', {
      error: errMsg(err),
    });
  }
}

/** Borra las imágenes de todas las conversaciones de un favor (se usa al marcarlo como resuelto). */
export async function purgeFavorChatImages(admin: SupabaseClient<Database>, favorId: string): Promise<void> {
  try {
    const { data, error } = await admin.from('conversations').select('id').eq('favor_id', favorId);
    if (error) throw error;
    await purgeChatImages(admin, (data ?? []).map((c) => c.id));
  } catch (err) {
    logger.error('No se pudieron borrar las imágenes de los chats del favor', {
      favorId,
      error: errMsg(err),
    });
  }
}
