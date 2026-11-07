import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, TablesUpdate } from '../types/database.types';
import { AppError } from '../middlewares/errorHandler';

type Client = SupabaseClient<Database>;

// Un favor ya cerrado o cancelado no tiene nada que moderar.
const MODERABLE_STATUSES: Tables<'favors'>['status'][] = ['abierta', 'en_curso'];

export class ModerationService {
  /**
   * Cola de la zona del admin, los más antiguos primero.
   */
  public async listPending(
    supabase: Client,
    zoneId: string,
    { limit, offset }: { limit: number; offset: number }
  ): Promise<Tables<'favors'>[]> {
    const { data, error } = await supabase
      .from('favors')
      .select('*, author:users!favors_author_id_fkey(id, full_name, avatar_url)')
      .eq('zone_id', zoneId)
      .eq('moderation_status', 'pendiente')
      .is('deleted_at', null)
      .in('status', MODERABLE_STATUSES)
      .order('created_at', { ascending: true })
      .order('id')
      .range(offset, offset + limit - 1);

    if (error) {
      throw new AppError(`Error al consultar la cola de moderación: ${error.message}`, 400);
    }

    return (data as unknown as Tables<'favors'>[]) || [];
  }

  public async approve(
    supabase: Client,
    adminId: string,
    zoneId: string,
    favorId: string
  ): Promise<Tables<'favors'>> {
    const { updated } = await this.moderate(supabase, adminId, zoneId, favorId, {
      moderation_status: 'aprobado',
      moderation_reason: null,
    });
    return updated;
  }

  /**
   * Rechazar retira el favor con el mismo soft-delete que usa su autor:
   * sale del listado y updateFavor ya bloquea su edición.
   */
  public async reject(
    supabase: Client,
    adminId: string,
    zoneId: string,
    favorId: string,
    reason: string
  ): Promise<Tables<'favors'>> {
    const now = new Date().toISOString();
    const { updated, fromStatus } = await this.moderate(supabase, adminId, zoneId, favorId, {
      moderation_status: 'rechazado',
      moderation_reason: reason,
      status: 'cancelada',
      deleted_at: now,
      closed_at: now,
    });

    await supabase.from('favor_events').insert({
      favor_id: favorId,
      actor_user_id: adminId,
      from_status: fromStatus,
      to_status: 'cancelada',
    });

    return updated;
  }

  /**
   * El filtro sobre 'pendiente' resuelve la concurrencia: de dos admins, solo uno afecta la fila
   * y el otro recibe 409. El registro en audit_logs lo escribe el trigger de la migración 0008.
   */
  private async moderate(
    supabase: Client,
    adminId: string,
    zoneId: string,
    favorId: string,
    decision: TablesUpdate<'favors'>
  ): Promise<{ updated: Tables<'favors'>; fromStatus: Tables<'favors'>['status'] }> {
    const { data: favor, error: readError } = await supabase
      .from('favors')
      .select('author_id, zone_id, status')
      .eq('id', favorId)
      .single();

    if (readError || !favor) {
      throw new AppError('Favor no encontrado', 404);
    }

    if (favor.zone_id !== zoneId) {
      throw new AppError('Acceso denegado: este favor no pertenece a tu zona', 403);
    }

    if (favor.author_id === adminId) {
      throw new AppError('No puedes moderar tus propios favores', 403);
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('favors')
      .update({ ...decision, moderated_by: adminId, moderated_at: now, updated_at: now })
      .eq('id', favorId)
      .eq('moderation_status', 'pendiente')
      .is('deleted_at', null)
      .in('status', MODERABLE_STATUSES)
      .select()
      .maybeSingle();

    if (updateError) {
      throw new AppError(`No se pudo moderar el favor: ${updateError.message}`, 400);
    }

    if (!updated) {
      throw new AppError('Este favor ya no está pendiente de moderación', 409);
    }

    return { updated, fromStatus: favor.status };
  }
}

export const moderationService = new ModerationService();
