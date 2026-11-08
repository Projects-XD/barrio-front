import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, Tables } from '../types/database.types';
import { AppError, dbError } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import { purgeChatImages } from '../utils/chatImages';
import type {
  ReportConversationUserDTO,
  SendMessageDTO,
  UpdateConversationDTO,
} from '../utils/validators';

// Máximo de mensajes que un vecino puede enviar por minuto entre todas sus conversaciones.
export const MESSAGES_PER_MINUTE = 15;

const PREVIEW_MAX = 120;

// Texto corto del mensaje para el aviso: su contenido, o una descripción si solo trae imágenes.
export function mensajePreview(message: { body?: string | null; images?: string[] | null }): string {
  const body = (message.body ?? '').trim();
  if (body) return body.length > PREVIEW_MAX ? body.slice(0, PREVIEW_MAX - 1) + '…' : body;
  const n = message.images?.length ?? 0;
  if (n === 1) return 'Te envió una imagen';
  if (n > 1) return `Te envió ${n} imágenes`;
  return '';
}

type UserLite = { id: string; full_name: string; avatar_url: string | null };

export type ConversationView = Tables<'conversations'> & {
  favor: { id: string; title: string; status: Tables<'favors'>['status'] } | null;
  author: UserLite | null;
  responder: UserLite | null;
  // Solo lo calcula getConversation: indica si quien consulta bloqueó al otro vecino.
  blocked_by_me?: boolean;
  // ID del perfil profesional del otro vecino si ofrece algún oficio en el barrio
  other_profile_id?: string | null;
};

const CONVERSATION_SELECT =
  '*, favor:favors(id, title, status), author:users!conversations_author_id_fkey(id, full_name, avatar_url), responder:users!conversations_responder_id_fkey(id, full_name, avatar_url)';

type Client = SupabaseClient<Database>;

export class ConversationService {
  /**
   * Devuelve la conversación solo si el usuario es uno de sus dos participantes.
   * Para cualquier otro usuario responde 404, igual que si no existiera.
   */
  private async getAsParticipant(
    supabase: Client,
    userId: string,
    conversationId: string
  ): Promise<Tables<'conversations'>> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();

    if (error) {
      throw dbError('Error al consultar la conversación', error);
    }
    if (!data || (data.author_id !== userId && data.responder_id !== userId)) {
      throw new AppError('Conversación no encontrada', 404);
    }
    return data;
  }

  private otherUserId(conversation: Tables<'conversations'>, userId: string): string {
    return conversation.author_id === userId ? conversation.responder_id : conversation.author_id;
  }

  /**
   * Conversaciones del usuario (como autor o como quien respondió), la más reciente primero.
   * Con favorId, solo las de ese favor.
   */
  public async listConversations(
    supabase: Client,
    userId: string,
    favorId?: string
  ): Promise<ConversationView[]> {
    let query = supabase
      .from('conversations')
      .select(CONVERSATION_SELECT)
      .or(`author_id.eq.${userId},responder_id.eq.${userId}`)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (favorId) {
      query = query.eq('favor_id', favorId);
    }

    const { data, error } = await query;
    if (error) {
      throw dbError('Error al consultar conversaciones', error);
    }
    return (data ?? []) as unknown as ConversationView[];
  }

  public async getConversation(
    supabase: Client,
    userId: string,
    conversationId: string
  ): Promise<ConversationView> {
    const { data, error } = await supabase
      .from('conversations')
      .select(CONVERSATION_SELECT)
      .eq('id', conversationId)
      .maybeSingle();

    if (error) {
      throw dbError('Error al consultar la conversación', error);
    }
    if (!data || (data.author_id !== userId && data.responder_id !== userId)) {
      throw new AppError('Conversación no encontrada', 404);
    }

    const otherId = this.otherUserId(data, userId);

    const [{ data: block, error: blockError }, { data: proProfile }] = await Promise.all([
      supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', userId)
        .eq('blocked_id', otherId)
        .maybeSingle(),
      supabase
        .from('professional_profiles')
        .select('id')
        .eq('user_id', otherId)
        .maybeSingle(),
    ]);

    if (blockError) {
      throw dbError('Error al validar bloqueos', blockError);
    }

    return {
      ...(data as unknown as ConversationView),
      blocked_by_me: Boolean(block),
      other_profile_id: proProfile?.id ?? null,
    };
  }

  /**
   * Últimos mensajes de la conversación en orden cronológico.
   * Los mensajes del otro vecino que aún no estaban leídos quedan marcados como leídos.
   */
  public async listMessages(
    supabase: Client,
    userId: string,
    conversationId: string,
    limit: number
  ): Promise<Tables<'messages'>[]> {
    await this.getAsParticipant(supabase, userId, conversationId);

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit);

    if (error) {
      throw dbError('Error al consultar mensajes', error);
    }

    const messages = (data ?? []).reverse();

    const unreadIds = messages.filter((m) => m.sender_id !== userId && !m.read_at).map((m) => m.id);
    if (unreadIds.length > 0) {
      const readAt = new Date().toISOString();
      const { error: readError } = await supabase
        .from('messages')
        .update({ read_at: readAt })
        .in('id', unreadIds);

      if (readError) {
        logger.error('No se pudieron marcar mensajes como leídos', { conversationId, error: readError.message });
      } else {
        for (const m of messages) {
          if (unreadIds.includes(m.id)) m.read_at = readAt;
        }
      }
    }

    // El aviso de mensajes de esta conversación deja de contar: el próximo mensaje crea uno nuevo con count 1.
    const { error: avisoError } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('type', 'nuevo_mensaje')
      .is('read_at', null)
      .eq('payload->>conversation_id', conversationId);
    if (avisoError) {
      logger.error('No se pudo marcar como leído el aviso de mensajes', { conversationId, error: avisoError.message });
    }

    return messages;
  }

  public async sendMessage(
    supabase: Client,
    userId: string,
    conversationId: string,
    dto: SendMessageDTO
  ): Promise<Tables<'messages'>> {
    const conversation = await this.getAsParticipant(supabase, userId, conversationId);
    const otherId = this.otherUserId(conversation, userId);

    if (conversation.closed_at) {
      throw new AppError('La conversación está cerrada', 409);
    }

    // Un bloqueo en cualquier sentido impide escribir. Quien fue bloqueado no se entera de que lo fue.
    const { data: blocks, error: blockError } = await supabase
      .from('user_blocks')
      .select('blocker_id')
      .or(
        `and(blocker_id.eq.${userId},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${userId})`
      );

    if (blockError) {
      throw dbError('Error al validar bloqueos', blockError);
    }
    if (blocks?.some((b) => b.blocker_id === userId)) {
      throw new AppError('Bloqueaste a este vecino', 403);
    }
    if (blocks && blocks.length > 0) {
      throw new AppError('No puedes enviar mensajes en esta conversación', 403);
    }

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count: recent, error: countError } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', userId)
      .gte('created_at', since);

    if (countError) {
      throw dbError('Error al validar el ritmo de mensajes', countError);
    }
    if ((recent ?? 0) >= MESSAGES_PER_MINUTE) {
      throw new AppError('Estás enviando mensajes muy rápido. Espera un momento.', 429);
    }

    const { data: message, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: userId, body: dto.body, images: dto.images })
      .select('*')
      .single();

    if (error || !message) {
      throw new AppError(`Error al enviar el mensaje: ${error?.message ?? 'sin datos'}`, 400);
    }

    // El mensaje ya quedó guardado: si falla lo secundario, no se le devuelve error al remitente.
    try {
      await supabase
        .from('conversations')
        .update({ last_message_at: message.created_at })
        .eq('id', conversationId);

      const recipientMuted =
        conversation.author_id === otherId ? conversation.author_muted : conversation.responder_muted;
      if (!recipientMuted) {
        await this.notifyNewMessage(supabase, conversation, userId, otherId, message);
      }
    } catch (secondaryError) {
      logger.error('Falló la actualización posterior al envío de un mensaje', {
        conversationId,
        error: secondaryError instanceof Error ? secondaryError.message : String(secondaryError),
      });
    }

    return message;
  }

  // Un solo aviso sin leer por conversación, para no llenar la bandeja. Los mensajes seguidos no crean
  // otro aviso: actualizan el mismo con el total (`count`) y el contenido de los dos últimos (`mensajes`).
  private async notifyNewMessage(
    supabase: Client,
    conversation: Tables<'conversations'>,
    senderId: string,
    recipientId: string,
    message: Tables<'messages'>
  ): Promise<void> {
    const preview = mensajePreview(message);

    const { data: existing } = await supabase
      .from('notifications')
      .select('id, payload')
      .eq('user_id', recipientId)
      .eq('type', 'nuevo_mensaje')
      .is('read_at', null)
      .eq('payload->>conversation_id', conversation.id)
      .limit(1);

    const current = existing?.[0];
    if (current) {
      const payload = (current.payload ?? {}) as Record<string, unknown>;
      const anteriores = Array.isArray(payload.mensajes) ? (payload.mensajes as string[]) : [];
      const count = (typeof payload.count === 'number' ? payload.count : 1) + 1;
      await supabase
        .from('notifications')
        .update({
          payload: { ...payload, count, mensajes: [...anteriores, preview].slice(-2) } as Json,
          updated_at: new Date().toISOString(),
        })
        .eq('id', current.id);
      return;
    }

    const [{ data: sender }, { data: favor }] = await Promise.all([
      supabase.from('users').select('full_name').eq('id', senderId).maybeSingle(),
      supabase.from('favors').select('title').eq('id', conversation.favor_id).maybeSingle(),
    ]);

    await supabase.from('notifications').insert({
      user_id: recipientId,
      type: 'nuevo_mensaje',
      payload: {
        favor_id: conversation.favor_id,
        favor_title: favor?.title ?? null,
        conversation_id: conversation.id,
        sender_id: senderId,
        sender_name: sender?.full_name ?? null,
        count: 1,
        mensajes: [preview],
      },
    });
  }

  /** Al cerrarse un chat se borran sus imágenes (Storage + BD). Nunca hace fallar el cierre. */
  private async purgeImages(conversationIds: string[]): Promise<void> {
    try {
      const { supabaseAdmin } = await import('../config/supabase');
      await purgeChatImages(supabaseAdmin, conversationIds);
    } catch (err) {
      logger.error('No se pudo iniciar el borrado de imágenes del chat', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Silenciar (solo afecta a quien lo pide: deja de recibir avisos) o cerrar la conversación.
   */
  public async updateConversation(
    supabase: Client,
    userId: string,
    conversationId: string,
    dto: UpdateConversationDTO
  ): Promise<ConversationView> {
    const conversation = await this.getAsParticipant(supabase, userId, conversationId);

    const changes: Partial<Tables<'conversations'>> = {};
    if (dto.muted !== undefined) {
      if (conversation.author_id === userId) changes.author_muted = dto.muted;
      else changes.responder_muted = dto.muted;
    }
    if (dto.closed) {
      if (conversation.closed_at) {
        throw new AppError('La conversación ya está cerrada', 409);
      }
      changes.closed_at = new Date().toISOString();
    }

    if (Object.keys(changes).length > 0) {
      const { error } = await supabase.from('conversations').update(changes).eq('id', conversationId);
      if (error) {
        throw dbError('Error al actualizar la conversación', error);
      }
      if (changes.closed_at) await this.purgeImages([conversationId]);
    }

    return this.getConversation(supabase, userId, conversationId);
  }

  /**
   * Bloquea al otro vecino y cierra todas las conversaciones abiertas entre ambos.
   * Es idempotente: bloquear a quien ya estaba bloqueado no da error.
   */
  public async blockOtherUser(
    supabase: Client,
    userId: string,
    conversationId: string
  ): Promise<{ blocked_user_id: string }> {
    const conversation = await this.getAsParticipant(supabase, userId, conversationId);
    const otherId = this.otherUserId(conversation, userId);

    const { error } = await supabase.from('user_blocks').insert({ blocker_id: userId, blocked_id: otherId });
    if (error && error.code !== '23505') {
      throw dbError('Error al bloquear al vecino', error);
    }

    const { data: closed, error: closeError } = await supabase
      .from('conversations')
      .update({ closed_at: new Date().toISOString() })
      .is('closed_at', null)
      .or(
        `and(author_id.eq.${userId},responder_id.eq.${otherId}),and(author_id.eq.${otherId},responder_id.eq.${userId})`
      )
      .select('id');

    if (closeError) {
      throw dbError('Error al cerrar las conversaciones', closeError);
    }
    await this.purgeImages(Array.isArray(closed) ? closed.map((c) => c.id) : []);

    return { blocked_user_id: otherId };
  }

  /**
   * Quita el bloqueo que el propio usuario puso al otro vecino y reabre las conversaciones entre ambos.
   * Solo desbloquea quien bloqueó: borra únicamente el bloqueo propio. Es idempotente.
   */
  public async unblockOtherUser(
    supabase: Client,
    userId: string,
    conversationId: string
  ): Promise<{ unblocked_user_id: string }> {
    const conversation = await this.getAsParticipant(supabase, userId, conversationId);
    const otherId = this.otherUserId(conversation, userId);

    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', otherId);

    if (error) {
      throw dbError('Error al desbloquear al vecino', error);
    }

    // Si el otro vecino también te había bloqueado, las conversaciones siguen impedidas por su bloqueo
    // (sendMessage lo valida), aunque aquí se reabran.
    const { error: reopenError } = await supabase
      .from('conversations')
      .update({ closed_at: null })
      .not('closed_at', 'is', null)
      .or(
        `and(author_id.eq.${userId},responder_id.eq.${otherId}),and(author_id.eq.${otherId},responder_id.eq.${userId})`
      );

    if (reopenError) {
      throw dbError('Error al reabrir las conversaciones', reopenError);
    }

    return { unblocked_user_id: otherId };
  }

  /**
   * Reporta al otro vecino para moderación (user_reports).
   */
  public async reportOtherUser(
    supabase: Client,
    userId: string,
    conversationId: string,
    dto: ReportConversationUserDTO
  ): Promise<Tables<'user_reports'>> {
    const conversation = await this.getAsParticipant(supabase, userId, conversationId);
    const otherId = this.otherUserId(conversation, userId);

    const context = `[conversación ${conversationId}]`;
    const { data, error } = await supabase
      .from('user_reports')
      .insert({
        reporter_user_id: userId,
        target_type: 'user',
        target_id: otherId,
        reason: dto.reason,
        details: dto.details ? `${context} ${dto.details}` : context,
      })
      .select('*')
      .single();

    // 23505 = unique_violation (índice uq_user_reports_usuario_una_vez, migración 0030)
    if (error?.code === '23505') {
      throw new AppError('Ya reportaste a este vecino', 409);
    }
    if (error || !data) {
      throw new AppError(`Error al enviar el reporte: ${error?.message ?? 'sin datos'}`, 400);
    }
    return data;
  }
}

export const conversationService = new ConversationService();
