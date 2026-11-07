import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/database.types';
import { AppError } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';
import type {
  ReportConversationUserDTO,
  SendMessageDTO,
  UpdateConversationDTO,
} from '../utils/validators';

// Máximo de mensajes que un vecino puede enviar por minuto entre todas sus conversaciones.
export const MESSAGES_PER_MINUTE = 15;

type UserLite = { id: string; full_name: string; avatar_url: string | null };

export type ConversationView = Tables<'conversations'> & {
  favor: { id: string; title: string } | null;
  author: UserLite | null;
  responder: UserLite | null;
};

const CONVERSATION_SELECT =
  '*, favor:favors(id, title), author:users!conversations_author_id_fkey(id, full_name, avatar_url), responder:users!conversations_responder_id_fkey(id, full_name, avatar_url)';

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
      throw new AppError(`Error al consultar la conversación: ${error.message}`, 400);
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
      throw new AppError(`Error al consultar conversaciones: ${error.message}`, 400);
    }
    return (data ?? []) as unknown as ConversationView[];
  }

  public async getConversation(
    supabase: Client,
    userId: string,
    conversationId: string
  ): Promise<ConversationView> {
    await this.getAsParticipant(supabase, userId, conversationId);

    const { data, error } = await supabase
      .from('conversations')
      .select(CONVERSATION_SELECT)
      .eq('id', conversationId)
      .single();

    if (error || !data) {
      throw new AppError('Conversación no encontrada', 404);
    }
    return data as unknown as ConversationView;
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
      throw new AppError(`Error al consultar mensajes: ${error.message}`, 400);
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
      throw new AppError(`Error al validar bloqueos: ${blockError.message}`, 400);
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
      throw new AppError(`Error al validar el ritmo de mensajes: ${countError.message}`, 400);
    }
    if ((recent ?? 0) >= MESSAGES_PER_MINUTE) {
      throw new AppError('Estás enviando mensajes muy rápido. Espera un momento.', 429);
    }

    const { data: message, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: userId, body: dto.body })
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
        await this.notifyNewMessage(supabase, conversation, userId, otherId);
      }
    } catch (secondaryError) {
      logger.error('Falló la actualización posterior al envío de un mensaje', {
        conversationId,
        error: secondaryError instanceof Error ? secondaryError.message : String(secondaryError),
      });
    }

    return message;
  }

  // Un solo aviso sin leer por conversación: así una charla activa no llena la bandeja de avisos.
  private async notifyNewMessage(
    supabase: Client,
    conversation: Tables<'conversations'>,
    senderId: string,
    recipientId: string
  ): Promise<void> {
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', recipientId)
      .eq('type', 'nuevo_mensaje')
      .is('read_at', null)
      .eq('payload->>conversation_id', conversation.id)
      .limit(1);

    if (existing && existing.length > 0) return;

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
      },
    });
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
    if (dto.closed && !conversation.closed_at) {
      changes.closed_at = new Date().toISOString();
    }

    if (Object.keys(changes).length > 0) {
      const { error } = await supabase.from('conversations').update(changes).eq('id', conversationId);
      if (error) {
        throw new AppError(`Error al actualizar la conversación: ${error.message}`, 400);
      }
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
      throw new AppError(`Error al bloquear al vecino: ${error.message}`, 400);
    }

    const { error: closeError } = await supabase
      .from('conversations')
      .update({ closed_at: new Date().toISOString() })
      .is('closed_at', null)
      .or(
        `and(author_id.eq.${userId},responder_id.eq.${otherId}),and(author_id.eq.${otherId},responder_id.eq.${userId})`
      );

    if (closeError) {
      throw new AppError(`Error al cerrar las conversaciones: ${closeError.message}`, 400);
    }

    return { blocked_user_id: otherId };
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

    if (error || !data) {
      throw new AppError(`Error al enviar el reporte: ${error?.message ?? 'sin datos'}`, 400);
    }
    return data;
  }
}

export const conversationService = new ConversationService();
