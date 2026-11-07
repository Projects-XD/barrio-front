import { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  Tables,
  FavorType,
  ReportReason,
} from '../types/database.types';
import { AppError } from '../middlewares/errorHandler';
import type { CreateFavorDTO, UpdateFavorDTO, CreateFavorInterestDTO } from '../utils/validators';
import { resolveUserZone } from './zoneAccess';

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
// TEMPORAL (pruebas): límite diario desactivado. Cambia a true para reactivar los 5 favores/día.
const DAILY_LIMIT_ENABLED = false;
const DAILY_FAVOR_LIMIT_BASE = 5;
const DAILY_FAVOR_LIMIT_TRUSTED = 15;
const TRUSTED_REPUTATION_THRESHOLD = 3;
// Lo que usa la app en las listas; el detalle (GET /favors/:id) sigue trayendo la fila completa.
const FAVOR_LIST_COLUMNS =
  'id, author_id, zone_id, type, title, description, status, client_id, created_at, urgency, moderation_status, moderation_reason, assigned_to_user_id, location_lat, location_lng';

const isWithinEditWindow = (createdAt: string) =>
  Date.now() - new Date(createdAt).getTime() <= EDIT_WINDOW_MS;

function validateFavorTitleText(rawTitle: string): string {
  const clean = rawTitle.trim();
  // Si viene con prefijo "Necesito: " u "Ofrezco: ", validar que el cuerpo real también sea válido
  const withoutPrefix = clean.replace(/^(?:Necesito|Ofrezco)(?:\s*\([^)]*\))?:\s*/i, '').trim();
  if (clean.length < 5 || (withoutPrefix.length > 0 && withoutPrefix.length < 3)) {
    throw new AppError('El título debe tener al menos 5 caracteres.', 400);
  }
  if (/(.)\1{4,}/i.test(clean)) {
    throw new AppError('El título tiene letras repetidas. Escribe algo más claro.', 400);
  }
  return clean;
}

function mapReasonToEnum(reasonText: string): ReportReason {
  const lower = reasonText.toLowerCase();
  if (lower.includes('spam') || lower.includes('broma')) return 'spam';
  if (lower.includes('ofensivo') || lower.includes('inapropiado')) return 'contenido_inapropiado';
  if (lower.includes('real') || lower.includes('falso')) return 'datos_falsos';
  if (lower.includes('acoso')) return 'acoso';
  return 'otro';
}

export class FavorService {
  /**
   * Lista favores vecinales activos (status = 'abierta' o 'en_curso') de la zona del usuario.
   * REGLA DE ZONA: 403 si pidió otra zona.
   */
  public async listActiveFavors(
    supabase: SupabaseClient<Database>,
    userId: string,
    params: { zoneId?: string; type?: FavorType; limit?: number; offset?: number }
  ): Promise<Tables<'favors'>[]> {
    const zoneId = await resolveUserZone(supabase, userId, params.zoneId);

    let query = supabase
      .from('favors')
      .select(`${FAVOR_LIST_COLUMNS}, author:users!favors_author_id_fkey(id, full_name, avatar_url)`)
      .eq('zone_id', zoneId)
      .in('status', ['abierta', 'en_curso'])
      .is('deleted_at', null)
      // Sin aprobar solo lo ve su autor. userId sale del token verificado, no del cliente.
      .or(`moderation_status.eq.aprobado,author_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .order('id'); // desempate estable: la paginación no repite ni omite filas

    if (params.type) {
      query = query.eq('type', params.type);
    }

    if (params.limit !== undefined) {
      const from = params.offset ?? 0;
      query = query.range(from, from + params.limit - 1);
    }

    const { data, error } = await query;
    if (error) {
      throw new AppError(`Error al consultar favores: ${error.message}`, 400);
    }

    return (data as unknown as Tables<'favors'>[]) || [];
  }

  /**
   * Obtiene el detalle de un favor por su ID.
   * REGLA DE ZONA: solo su autor o un vecino de la misma zona pueden verlo.
   * Un favor desactivado responde 200 con is_deactivated = true. Solo su autor ve el contenido.
   */
  public async getFavorById(
    supabase: SupabaseClient<Database>,
    userId: string,
    favorId: string
  ): Promise<
    Tables<'favors'> & {
      interests: Tables<'favor_interests'>[];
      is_deactivated: boolean;
      can_edit: boolean;
    }
  > {
    const { data, error } = await supabase
      .from('favors')
      .select('*, author:users!favors_author_id_fkey(id, full_name, avatar_url), interests:favor_interests(*, user:users!favor_interests_user_id_fkey(id, full_name, avatar_url))')
      .eq('id', favorId)
      .single();

    // Solo "0 filas" (PGRST116) e "ID no es UUID" (22P02) significan que no existe.
    if (error && error.code !== 'PGRST116' && error.code !== '22P02') throw new AppError(`Error al consultar el favor: ${error.message}`, 500);
    if (!data) throw new AppError('Favor no encontrado', 404);

    if (data.author_id !== userId && data.zone_id !== (await resolveUserZone(supabase, userId))) {
      throw new AppError('Acceso denegado: este favor no pertenece a tu zona', 403);
    }

    const favor = data as unknown as Tables<'favors'> & { interests: Tables<'favor_interests'>[] };
    const isAuthor = favor.author_id === userId;
    const isDeactivated = favor.deleted_at !== null;
    const flags = {
      is_deactivated: isDeactivated,
      can_edit: isAuthor && !isDeactivated && isWithinEditWindow(favor.created_at),
    };

    if (isDeactivated && !isAuthor) {
      return {
        ...favor,
        ...flags,
        title: '',
        description: null,
        location_lat: null,
        location_lng: null,
        assigned_to_user_id: null,
        moderated_by: null,
        moderation_reason: null,
        interests: [],
      };
    }

    return { ...favor, ...flags };
  }

  /**
   * Crea un nuevo favor comunitario.
   * Regla de Negocio: Valida obligatoriamente client_id para evitar duplicidad e idempotencia,
   * title (máx 120 chars) y type.
   * Regla de Zona: el favor queda en la zona del autor, sin importar el zone_id recibido.
   */
  public async createFavor(
    supabase: SupabaseClient<Database>,
    authorId: string,
    dto: CreateFavorDTO
  ): Promise<Tables<'favors'>> {
    // 1. Comprobar si ya existe un favor con el mismo client_id para este autor (Idempotencia)
    const { data: existing } = await supabase
      .from('favors')
      .select('*')
      .eq('author_id', authorId)
      .eq('client_id', dto.client_id)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    // 2. Validar título, duplicados en las últimas 24 h y límite diario (5 al día, o 15 si tiene >= 3 favores cerrados)
    const cleanTitle = validateFavorTitleText(dto.title);
    const since24h = new Date(Date.now() - EDIT_WINDOW_MS).toISOString();

    const [{ data: recentFavors }, { count: closedCount }] = await Promise.all([
      supabase
        .from('favors')
        .select('id, title')
        .eq('author_id', authorId)
        .is('deleted_at', null)
        .gt('created_at', since24h),
      supabase
        .from('favors')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', authorId)
        .eq('status', 'cerrada'),
    ]);

    const recentList = recentFavors ?? [];
    const hasDuplicateToday = recentList.some(
      (f) => f.title.trim().toLowerCase() === cleanTitle.toLowerCase()
    );
    if (hasDuplicateToday) {
      throw new AppError('Ya publicaste un favor con ese título hoy.', 400);
    }

    const reputation = closedCount ?? 0;
    const dailyLimit =
      reputation >= TRUSTED_REPUTATION_THRESHOLD ? DAILY_FAVOR_LIMIT_TRUSTED : DAILY_FAVOR_LIMIT_BASE;

    if (DAILY_LIMIT_ENABLED && recentList.length >= dailyLimit) {
      throw new AppError(`Llegaste al límite de ${dailyLimit} favores por día.`, 400);
    }

    // 3. La zona sale de public.users, nunca del cliente
    const zoneId = await resolveUserZone(supabase, authorId);

    // 4. Insertar el nuevo favor aprobado directamente (sin revisión manual de admin)
    const { data, error } = await supabase
      .from('favors')
      .insert({
        author_id: authorId,
        client_id: dto.client_id,
        zone_id: zoneId,
        type: dto.type,
        title: cleanTitle,
        description: dto.description ?? null,
        location_lat: dto.location_lat ?? null,
        location_lng: dto.location_lng ?? null,
        status: 'abierta',
        sync_status: 'enviado',
        urgency: dto.urgency,
        moderation_status: 'aprobado',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: duplicate } = await supabase
          .from('favors')
          .select('*')
          .eq('author_id', authorId)
          .eq('client_id', dto.client_id)
          .single();
        if (duplicate) return duplicate;
      }
      throw new AppError(`Error al crear el favor: ${error.message}`, 400);
    }

    // 4. Registrar evento inicial en favor_events
    await supabase.from('favor_events').insert({
      favor_id: data.id,
      actor_user_id: authorId,
      from_status: null,
      to_status: 'abierta',
    });

    return data;
  }

  /**
   * Añade un registro de interés en favor_interests.
   * REGLA DE ZONA: 403 si el favor no es de la zona del usuario, salvo que sea su autor
   * (el autor recibe el 400 de abajo, porque no puede interesarse en su propio favor).
   */
  public async addInterest(
    supabase: SupabaseClient<Database>,
    userId: string,
    favorId: string,
    dto: CreateFavorInterestDTO
  ): Promise<Tables<'favor_interests'> & { conversation_id: string }> {
    // 1. Validar existencia y estado del favor
    const { data: favor, error: favorError } = await supabase
      .from('favors')
      .select('id, author_id, status, zone_id')
      .eq('id', favorId)
      .single();

    if (favorError || !favor) {
      throw new AppError('Favor no encontrado', 404);
    }

    if (favor.author_id !== userId && favor.zone_id !== (await resolveUserZone(supabase, userId))) {
      throw new AppError('Acceso denegado: este favor no pertenece a tu zona', 403);
    }

    if (favor.status !== 'abierta' && favor.status !== 'en_curso') {
      throw new AppError('No se puede manifestar interés en un favor que ya está cerrado o cancelado', 400);
    }

    if (favor.author_id === userId) {
      throw new AppError('El autor del favor no puede manifestar interés en su propia publicación', 400);
    }

    // Si el autor bloqueó a este vecino no puede responder; no se revela el bloqueo.
    const { data: block } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', favor.author_id)
      .eq('blocked_id', userId)
      .maybeSingle();

    if (block) {
      throw new AppError('No puedes responder a este favor', 403);
    }

    // 2. Registrar interés, abrir la conversación y avisar al autor en una sola transacción
    const { data: result, error } = await supabase.rpc('fn_respond_to_favor', {
      p_favor_id: favorId,
      p_user_id: userId,
      p_message: dto.message ?? null,
    });

    if (error) {
      if (error.code === '23505') {
        throw new AppError('Ya has manifestado interés previamente en este favor', 409);
      }
      throw new AppError(`Error al registrar interés en el favor: ${error.message}`, 400);
    }

    const created = result?.[0];
    if (!created) {
      throw new AppError('Error al registrar interés en el favor', 500);
    }

    const { data, error: fetchError } = await supabase
      .from('favor_interests')
      .select('*, user:users(id, full_name, avatar_url)')
      .eq('id', created.interest_id)
      .single();

    if (fetchError || !data) {
      throw new AppError('Error al registrar interés en el favor', 500);
    }

    return {
      ...(data as unknown as Tables<'favor_interests'>),
      conversation_id: created.conversation_id,
    };
  }

  /**
   * Actualiza el estado o datos de un favor.
   * Un favor desactivado no admite cambios.
   * La ventana de 24 h aplica al contenido: pasado ese plazo el autor aún puede cerrar su favor.
   * Editar el contenido de cualquier favor lo devuelve a la cola: la aprobación cubría el texto anterior.
   */
  public async updateFavor(
    supabase: SupabaseClient<Database>,
    userId: string,
    favorId: string,
    dto: UpdateFavorDTO
  ): Promise<Tables<'favors'>> {
    const { data: currentFavor } = await supabase
      .from('favors')
      .select('status, created_at, deleted_at')
      .eq('id', favorId)
      .eq('author_id', userId)
      .single();

    if (!currentFavor) {
      throw new AppError('Favor no encontrado o no tienes permisos de edición', 404);
    }

    if (currentFavor.deleted_at) {
      throw new AppError('Este favor fue desactivado y ya no se puede modificar', 403);
    }

    const editsContent =
      dto.title !== undefined || dto.description !== undefined || dto.type !== undefined;

    if (editsContent && !isWithinEditWindow(currentFavor.created_at)) {
      throw new AppError('El plazo de 24 horas para editar este favor ya terminó', 403);
    }

    const validatedTitle = dto.title !== undefined ? validateFavorTitleText(dto.title) : undefined;

    const { data, error } = await supabase
      .from('favors')
      .update({
        ...(validatedTitle !== undefined && { title: validatedTitle }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.assigned_to_user_id !== undefined && { assigned_to_user_id: dto.assigned_to_user_id }),
        ...(dto.status === 'cerrada' || dto.status === 'cancelada'
          ? { closed_at: new Date().toISOString() }
          : {}),
        ...(editsContent && { edited_at: new Date().toISOString() }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', favorId)
      .eq('author_id', userId)
      .is('deleted_at', null) // un rechazo simultáneo gana: no se reabre un favor ya retirado
      .select()
      .single();

    if (error || !data) {
      throw new AppError(`No se pudo actualizar el favor: ${error?.message || 'Error desconocido'}`, 400);
    }

    // Si hubo cambio de estado, registrar en favor_events
    if (dto.status && dto.status !== currentFavor.status) {
      await supabase.from('favor_events').insert({
        favor_id: favorId,
        actor_user_id: userId,
        from_status: currentFavor.status,
        to_status: dto.status,
      });

      // Si se resolvió el favor con reconocimiento a un vecino ayudante, notificarle su aval solidario
      if (dto.status === 'cerrada' && dto.assigned_to_user_id && dto.assigned_to_user_id !== userId) {
        await supabase.from('notifications').insert({
          user_id: dto.assigned_to_user_id,
          type: 'visto_bueno_recibido',
          payload: {
            favor_id: favorId,
            favor_title: data.title,
            recognized_by: userId,
          },
        });
      }
    }

    return data;
  }

  /**
   * Desactiva un favor sin borrarlo. Solo su autor puede hacerlo y repetirlo no cambia nada.
   */
  public async softDeleteFavor(
    supabase: SupabaseClient<Database>,
    userId: string,
    favorId: string
  ): Promise<Tables<'favors'>> {
    const { data: currentFavor } = await supabase
      .from('favors')
      .select('*')
      .eq('id', favorId)
      .eq('author_id', userId)
      .single();

    if (!currentFavor) {
      throw new AppError('Favor no encontrado o no tienes permisos para desactivarlo', 404);
    }

    if (currentFavor.deleted_at) {
      return currentFavor;
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('favors')
      .update({
        status: 'cancelada',
        deleted_at: now,
        closed_at: currentFavor.closed_at ?? now,
        updated_at: now,
      })
      .eq('id', favorId)
      .eq('author_id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new AppError(`No se pudo desactivar el favor: ${error?.message || 'Error desconocido'}`, 400);
    }

    if (currentFavor.status !== 'cancelada') {
      await supabase.from('favor_events').insert({
        favor_id: favorId,
        actor_user_id: userId,
        from_status: currentFavor.status,
        to_status: 'cancelada',
      });
    }

    return data;
  }

  /**
   * Reporta un favor comunitario por parte de un vecino.
   * No permite reportar un favor propio ni reportar dos veces el mismo favor.
   * Al acumular >= 3 puntos de reporte (vecino con >= 3 favores cerrados suma 2 puntos, resto 1),
   * oculta automáticamente el favor (moderation_status = 'rechazado').
   */
  public async reportFavor(
    supabase: SupabaseClient<Database>,
    userId: string,
    favorId: string,
    reasonText: string
  ): Promise<{ hidden: boolean }> {
    const cleanReason = reasonText.trim();
    if (cleanReason.length < 3 || cleanReason.length > 200) {
      throw new AppError('El motivo del reporte debe tener entre 3 y 200 caracteres.', 400);
    }

    const { data: favor, error: favorErr } = await supabase
      .from('favors')
      .select('id, author_id, zone_id, moderation_status')
      .eq('id', favorId)
      .single();

    if (favorErr || !favor) {
      throw new AppError('Favor no encontrado.', 404);
    }

    if (favor.author_id === userId) {
      throw new AppError('No puedes reportar tu propio favor.', 400);
    }

    const userZone = await resolveUserZone(supabase, userId);
    if (favor.zone_id !== userZone) {
      throw new AppError('Acceso denegado: este favor no pertenece a tu zona.', 403);
    }

    // Comprobar si el vecino ya reportó este favor en user_reports
    const { data: existingReport } = await supabase
      .from('user_reports')
      .select('id')
      .eq('target_type', 'favor')
      .eq('target_id', favorId)
      .eq('reporter_user_id', userId)
      .maybeSingle();

    if (existingReport) {
      throw new AppError('Ya reportaste este favor.', 409);
    }

    const { error: insertErr } = await supabase.from('user_reports').insert({
      reporter_user_id: userId,
      target_type: 'favor',
      target_id: favorId,
      reason: mapReasonToEnum(cleanReason),
      details: cleanReason,
    });

    if (insertErr) {
      if (insertErr.code === '23505') {
        throw new AppError('Ya reportaste este favor.', 409);
      }
      throw new AppError(`No se pudo registrar el reporte: ${insertErr.message}`, 400);
    }

    // Calcular puntos acumulados de reporte para este favor
    const { data: allReports } = await supabase
      .from('user_reports')
      .select('reporter_user_id')
      .eq('target_type', 'favor')
      .eq('target_id', favorId);

    const uniqueReporters = Array.from(
      new Set((allReports ?? []).map((r) => r.reporter_user_id))
    );

    const { data: closedFavors } = await supabase
      .from('favors')
      .select('author_id')
      .in('author_id', uniqueReporters)
      .eq('status', 'cerrada');

    const closedByReporter = new Map<string, number>();
    for (const { author_id } of closedFavors ?? []) {
      closedByReporter.set(author_id, (closedByReporter.get(author_id) ?? 0) + 1);
    }

    let totalPoints = 0;
    for (const reporterId of uniqueReporters) {
      totalPoints += (closedByReporter.get(reporterId) ?? 0) >= TRUSTED_REPUTATION_THRESHOLD ? 2 : 1;
    }

    let hidden = favor.moderation_status === 'rechazado';
    if (totalPoints >= 3 && !hidden) {
      await supabase
        .from('favors')
        .update({
          moderation_status: 'rechazado',
          moderation_reason: 'Ocultado por reportes de vecinos',
          updated_at: new Date().toISOString(),
        })
        .eq('id', favorId);
      hidden = true;
    }

    return { hidden };
  }
}

export const favorService = new FavorService();
