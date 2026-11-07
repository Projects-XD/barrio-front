import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/database.types';
import { AppError, dbError } from '../middlewares/errorHandler';
import type { ListNotificationsQueryDTO } from '../utils/validators';

export class NotificationService {
  /**
   * Lista las notificaciones del propio usuario, las más recientes primero.
   */
  public async listNotifications(
    supabase: SupabaseClient<Database>,
    userId: string,
    params: ListNotificationsQueryDTO
  ): Promise<Tables<'notifications'>[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id') // desempate estable para la paginación
      .range(params.offset, params.offset + params.limit - 1);

    if (params.unread === 'true') {
      query = query.is('read_at', null);
    }

    const { data, error } = await query;
    if (error) {
      throw dbError('Error al consultar notificaciones', error);
    }

    return data ?? [];
  }

  /**
   * Cantidad de notificaciones sin leer, para el badge de la app.
   */
  public async countUnread(supabase: SupabaseClient<Database>, userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      throw dbError('Error al contar notificaciones', error);
    }

    return count ?? 0;
  }

  /**
   * Marca una notificación propia como leída. Es idempotente: si ya estaba leída, la devuelve igual.
   */
  public async markAsRead(
    supabase: SupabaseClient<Database>,
    userId: string,
    notificationId: string
  ): Promise<Tables<'notifications'>> {
    const { data: current, error: findError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (findError) {
      throw dbError('Error al consultar la notificación', findError);
    }
    if (!current) {
      throw new AppError('Notificación no encontrada', 404);
    }
    if (current.read_at) {
      return current;
    }

    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error || !data) {
      throw new AppError(`Error al marcar la notificación como leída: ${error?.message ?? 'sin datos'}`, 400);
    }

    return data;
  }
}

export const notificationService = new NotificationService();
