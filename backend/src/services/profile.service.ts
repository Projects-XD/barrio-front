import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, OficioCategory } from '../types/database.types';
import { AppError } from '../middlewares/errorHandler';
import type { CreateProfessionalProfileDTO, UpdateProfessionalProfileDTO } from '../utils/validators';

export class ProfileService {
  /**
   * Obtiene la lista de perfiles profesionales filtrados por zona y opcionalmente categoría de oficio.
   */
  public async listProfiles(
    supabase: SupabaseClient<Database>,
    params: { zoneId: string; category?: string }
  ): Promise<Tables<'professional_profiles'>[]> {
    let query = supabase
      .from('professional_profiles')
      .select('*, user:users(id, full_name, avatar_url), oficio:oficios(*)')
      .eq('zone_id', params.zoneId)
      .eq('is_visible', true)
      .order('is_validated', { ascending: false })
      .order('validated_count', { ascending: false });

    if (params.category) {
      query = query.eq('oficios.category', params.category as OficioCategory);
    }

    const { data, error } = await query;
    if (error) {
      throw new AppError(`Error al consultar perfiles: ${error.message}`, 400);
    }

    return (data as unknown as Tables<'professional_profiles'>[]) || [];
  }

  /**
   * Obtiene el detalle de un perfil profesional por su identificador UUID.
   */
  public async getProfileById(
    supabase: SupabaseClient<Database>,
    profileId: string
  ): Promise<Tables<'professional_profiles'>> {
    const { data, error } = await supabase
      .from('professional_profiles')
      .select('*, user:users(id, full_name, avatar_url), oficio:oficios(*)')
      .eq('id', profileId)
      .single();

    if (error || !data) {
      throw new AppError('Perfil profesional no encontrado', 404);
    }

    return data as unknown as Tables<'professional_profiles'>;
  }

  /**
   * Registra un nuevo perfil profesional para el usuario autenticado.
   */
  public async createProfile(
    supabase: SupabaseClient<Database>,
    userId: string,
    dto: CreateProfessionalProfileDTO
  ): Promise<Tables<'professional_profiles'>> {
    const { data, error } = await supabase
      .from('professional_profiles')
      .insert({
        user_id: userId,
        oficio_id: dto.oficio_id,
        zone_id: dto.zone_id ?? null,
        description: dto.description ?? null,
        years_experience: dto.years_experience ?? 0,
        location_lat: dto.location_lat ?? null,
        location_lng: dto.location_lng ?? null,
        is_visible: dto.is_visible ?? true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError('Ya tienes un perfil registrado para este oficio', 409);
      }
      throw new AppError(`Error al crear perfil profesional: ${error.message}`, 400);
    }

    return data;
  }

  /**
   * Actualiza el perfil profesional existente del usuario autenticado.
   */
  public async updateProfile(
    supabase: SupabaseClient<Database>,
    userId: string,
    profileId: string,
    dto: UpdateProfessionalProfileDTO
  ): Promise<Tables<'professional_profiles'>> {
    const { data, error } = await supabase
      .from('professional_profiles')
      .update({
        ...(dto.zone_id !== undefined && { zone_id: dto.zone_id }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.years_experience !== undefined && { years_experience: dto.years_experience }),
        ...(dto.location_lat !== undefined && { location_lat: dto.location_lat }),
        ...(dto.location_lng !== undefined && { location_lng: dto.location_lng }),
        ...(dto.is_visible !== undefined && { is_visible: dto.is_visible }),
      })
      .eq('id', profileId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new AppError('No se pudo actualizar el perfil o no tienes autorización', 400);
    }

    return data;
  }

  /**
   * Lista todos los oficios activos en el sistema.
   */
  public async listOficios(supabase: SupabaseClient<Database>): Promise<Tables<'oficios'>[]> {
    const { data, error } = await supabase
      .from('oficios')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      throw new AppError(`Error al obtener oficios: ${error.message}`, 400);
    }

    return data || [];
  }
}

export const profileService = new ProfileService();
