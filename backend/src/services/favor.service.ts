import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, FavorType } from '../types/database.types';
import { AppError } from '../middlewares/errorHandler';
import type { CreateFavorDTO, UpdateFavorDTO, CreateFavorInterestDTO } from '../utils/validators';
import { resolveUserZone } from './zoneAccess';

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

const isWithinEditWindow = (createdAt: string) =>
  Date.now() - new Date(createdAt).getTime() <= EDIT_WINDOW_MS;

export class FavorService {
  /**
   * Lista favores vecinales activos (status = 'abierta' o 'en_curso') de la zona del usuario.
   * REGLA DE ZONA: 403 si pidió otra zona.
   */
  public async listActiveFavors(
    supabase: SupabaseClient<Database>,
    userId: string,
    params: { zoneId?: string; type?: FavorType }
  ): Promise<Tables<'favors'>[]> {
    const zoneId = await resolveUserZone(supabase, userId, params.zoneId);

    let query = supabase
      .from('favors')
      .select('*, author:users!favors_author_id_fkey(id, full_name, avatar_url)')
      .eq('zone_id', zoneId)
      .in('status', ['abierta', 'en_curso'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (params.type) {
      query = query.eq('type', params.type);
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
      .select('*, author:users!favors_author_id_fkey(id, full_name, avatar_url), interests:favor_interests(*, user:users(id, full_name, avatar_url))')
      .eq('id', favorId)
      .single();

    if (error || !data) {
      throw new AppError('Favor no encontrado', 404);
    }

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

    // 2. La zona sale de public.users, nunca del cliente
    const zoneId = await resolveUserZone(supabase, authorId);

    // 3. Insertar el nuevo favor
    const { data, error } = await supabase
      .from('favors')
      .insert({
        author_id: authorId,
        client_id: dto.client_id,
        zone_id: zoneId,
        type: dto.type,
        title: dto.title,
        description: dto.description ?? null,
        location_lat: dto.location_lat ?? null,
        location_lng: dto.location_lng ?? null,
        status: 'abierta',
        sync_status: 'enviado',
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
  ): Promise<Tables<'favor_interests'>> {
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

    // 2. Insertar registro de interés
    const { data, error } = await supabase
      .from('favor_interests')
      .insert({
        favor_id: favorId,
        user_id: userId,
        message: dto.message ?? null,
      })
      .select('*, user:users(id, full_name, avatar_url)')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError('Ya has manifestado interés previamente en este favor', 409);
      }
      throw new AppError(`Error al registrar interés en el favor: ${error.message}`, 400);
    }

    return data as unknown as Tables<'favor_interests'>;
  }

  /**
   * Actualiza el estado o datos de un favor.
   * Un favor desactivado no admite cambios.
   * La ventana de 24 h aplica al contenido: pasado ese plazo el autor aún puede cerrar su favor.
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

    const { data, error } = await supabase
      .from('favors')
      .update({
        ...(dto.title !== undefined && { title: dto.title }),
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
}

export const favorService = new FavorService();
