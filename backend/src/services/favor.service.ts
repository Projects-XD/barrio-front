import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/database.types';
import { AppError } from '../middlewares/errorHandler';
import type { CreateFavorDTO, UpdateFavorDTO, CreateFavorInterestDTO } from '../utils/validators';

export class FavorService {
  /**
   * Lista favores vecinales con filtros por zona, tipo y estado.
   */
  public async listFavors(
    supabase: SupabaseClient<Database>,
    params: { zoneId: string; type?: string; status?: string }
  ): Promise<Tables<'favors'>[]> {
    let query = supabase
      .from('favors')
      .select('*, author:users!favors_author_id_fkey(id, full_name, avatar_url)')
      .eq('zone_id', params.zoneId)
      .order('created_at', { ascending: false });

    if (params.type) {
      query = query.eq('type', params.type as Tables<'favors'>['type']);
    }
    if (params.status) {
      query = query.eq('status', params.status as Tables<'favors'>['status']);
    } else {
      query = query.in('status', ['abierta', 'en_curso']);
    }

    const { data, error } = await query;
    if (error) {
      throw new AppError(`Error al consultar favores: ${error.message}`, 400);
    }

    return (data as unknown as Tables<'favors'>[]) || [];
  }

  /**
   * Obtiene un favor específico con sus interesados.
   */
  public async getFavorById(
    supabase: SupabaseClient<Database>,
    favorId: string
  ): Promise<Tables<'favors'> & { interests: Tables<'favor_interests'>[] }> {
    const { data, error } = await supabase
      .from('favors')
      .select('*, author:users!favors_author_id_fkey(id, full_name, avatar_url), interests:favor_interests(*)')
      .eq('id', favorId)
      .single();

    if (error || !data) {
      throw new AppError('Favor no encontrado', 404);
    }

    return data as unknown as Tables<'favors'> & { interests: Tables<'favor_interests'>[] };
  }

  /**
   * Crea un nuevo favor garantizando idempotencia a través de client_id.
   */
  public async createFavor(
    supabase: SupabaseClient<Database>,
    authorId: string,
    dto: CreateFavorDTO
  ): Promise<Tables<'favors'>> {
    const { data, error } = await supabase
      .from('favors')
      .insert({
        author_id: authorId,
        client_id: dto.client_id,
        zone_id: dto.zone_id ?? null,
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
        // Idempotencia: si ya existe el client_id para este autor, devolver el existente
        const { data: existing } = await supabase
          .from('favors')
          .select('*')
          .eq('author_id', authorId)
          .eq('client_id', dto.client_id)
          .single();

        if (existing) return existing;
      }
      throw new AppError(`Error al crear favor: ${error.message}`, 400);
    }

    return data;
  }

  /**
   * Actualiza el estado o detalles de un favor.
   */
  public async updateFavor(
    supabase: SupabaseClient<Database>,
    userId: string,
    favorId: string,
    dto: UpdateFavorDTO
  ): Promise<Tables<'favors'>> {
    const { data, error } = await supabase
      .from('favors')
      .update({
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.assigned_to_user_id !== undefined && { assigned_to_user_id: dto.assigned_to_user_id }),
        ...(dto.status === 'cerrada' || dto.status === 'cancelada' ? { closed_at: new Date().toISOString() } : {}),
      })
      .eq('id', favorId)
      .eq('author_id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new AppError('No se pudo actualizar el favor o no tienes permisos', 400);
    }

    return data;
  }

  /**
   * Expresa interés en colaborar en un favor.
   */
  public async expressInterest(
    supabase: SupabaseClient<Database>,
    userId: string,
    favorId: string,
    dto: CreateFavorInterestDTO
  ): Promise<Tables<'favor_interests'>> {
    const { data, error } = await supabase
      .from('favor_interests')
      .insert({
        favor_id: favorId,
        user_id: userId,
        message: dto.message ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError('Ya has manifestado interés en este favor', 409);
      }
      throw new AppError(`Error al expresar interés: ${error.message}`, 400);
    }

    return data;
  }
}

export const favorService = new FavorService();
