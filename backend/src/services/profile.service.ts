import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, OficioCategory } from '../types/database.types';
import { AppError } from '../middlewares/errorHandler';
import type { UpsertProfessionalProfileDTO } from '../utils/validators';

export class ProfileService {
  /**
   * Crea o actualiza el perfil profesional de un usuario autenticado.
   * Si ya existe un perfil para la dupla (user_id, oficio_id), actualiza los datos;
   * de lo contrario, inserta un nuevo registro.
   */
  public async upsertProfile(
    supabase: SupabaseClient<Database>,
    userId: string,
    dto: UpsertProfessionalProfileDTO
  ): Promise<Tables<'professional_profiles'>> {
    // 1. Determinar si ya existe un perfil para este usuario y oficio
    let existingId = dto.id;

    if (!existingId) {
      const { data: existing } = await supabase
        .from('professional_profiles')
        .select('id')
        .eq('user_id', userId)
        .eq('oficio_id', dto.oficio_id)
        .maybeSingle();

      if (existing) {
        existingId = existing.id;
      }
    }

    // 2. Si existe, actualizamos
    if (existingId) {
      const { data, error } = await supabase
        .from('professional_profiles')
        .update({
          oficio_id: dto.oficio_id,
          zone_id: dto.zone_id ?? null,
          description: dto.description ?? null,
          years_experience: dto.years_experience ?? 0,
          location_lat: dto.location_lat ?? null,
          location_lng: dto.location_lng ?? null,
          is_visible: dto.is_visible ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingId)
        .eq('user_id', userId)
        .select('*, oficio:oficios(*)')
        .single();

      if (error || !data) {
        throw new AppError(
          `No se pudo actualizar el perfil profesional: ${error?.message || 'Error desconocido'}`,
          400
        );
      }

      return data as unknown as Tables<'professional_profiles'>;
    }

    // 3. Si no existe, creamos el nuevo perfil
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
      .select('*, oficio:oficios(*)')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError('Ya tienes un perfil registrado para este oficio', 409);
      }
      throw new AppError(`Error al crear perfil profesional: ${error.message}`, 400);
    }

    return data as unknown as Tables<'professional_profiles'>;
  }

  /**
   * Obtiene la lista de perfiles profesionales filtrados por zone_id y opcionalmente oficio_id o category.
   */
  public async listProfiles(
    supabase: SupabaseClient<Database>,
    params: { zoneId: string; oficioId?: string; category?: OficioCategory }
  ): Promise<Tables<'professional_profiles'>[]> {
    let query = supabase
      .from('professional_profiles')
      .select('*, user:users!professional_profiles_user_id_fkey(id, full_name, avatar_url, zone_id), oficio:oficios(*)')
      .eq('zone_id', params.zoneId)
      .eq('is_visible', true)
      .order('is_validated', { ascending: false })
      .order('validated_count', { ascending: false });

    if (params.oficioId) {
      query = query.eq('oficio_id', params.oficioId);
    }

    if (params.category) {
      query = query.eq('oficios.category', params.category);
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
      .select('*, user:users!professional_profiles_user_id_fkey(id, full_name, avatar_url, zone_id), oficio:oficios(*)')
      .eq('id', profileId)
      .single();

    if (error || !data) {
      throw new AppError('Perfil profesional no encontrado', 404);
    }

    return data as unknown as Tables<'professional_profiles'>;
  }

  /**
   * Otorga un Visto Bueno (Vouch) a un perfil profesional.
   * REGLA DE NEGOCIO ESTRICTA EN NODE:
   * Antes de insertar en `vouches`, valida mediante query que el `zone_id` del usuario que da el visto bueno
   * (req.user.zone_id) sea exactamente el mismo `zone_id` del perfil al que se le da el visto bueno.
   * Si no coinciden, retorna HTTP 403 Forbidden.
   */
  public async giveVouch(
    supabase: SupabaseClient<Database>,
    voucherUserId: string,
    profileId: string
  ): Promise<{ profile: Tables<'professional_profiles'>; vouch: Tables<'vouches'> }> {
    // 1. Consultar el zone_id del usuario que emite el visto bueno en la tabla users
    const { data: voucherUser, error: userError } = await supabase
      .from('users')
      .select('id, zone_id')
      .eq('id', voucherUserId)
      .single();

    if (userError || !voucherUser) {
      throw new AppError('Usuario votante no encontrado en el sistema', 404);
    }

    if (!voucherUser.zone_id) {
      throw new AppError(
        'Debes pertenecer a una zona vecinal registrada para otorgar vistos buenos',
        403
      );
    }

    // 2. Consultar el perfil profesional objetivo y su zone_id
    const { data: targetProfile, error: profileError } = await supabase
      .from('professional_profiles')
      .select('id, user_id, zone_id')
      .eq('id', profileId)
      .single();

    if (profileError || !targetProfile) {
      throw new AppError('Perfil profesional objetivo no encontrado', 404);
    }

    // 3. Validación de auto-vouching
    if (targetProfile.user_id === voucherUserId) {
      throw new AppError('No puedes otorgarte un visto bueno a tu propio perfil', 400);
    }

    // 4. REGLA DE NEGOCIO ESTRICTA: Coincidencia exacta de zone_id
    if (!targetProfile.zone_id || voucherUser.zone_id !== targetProfile.zone_id) {
      throw new AppError(
        'Acceso denegado: solo los vecinos pertenecientes a la misma zona del perfil pueden otorgar un visto bueno',
        403
      );
    }

    // 5. Insertar en la tabla vouches
    const { data: vouch, error: insertError } = await supabase
      .from('vouches')
      .insert({
        profile_id: profileId,
        voucher_user_id: voucherUserId,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        throw new AppError('Ya has otorgado un visto bueno a este perfil profesional', 409);
      }
      throw new AppError(`Error al registrar visto bueno: ${insertError.message}`, 400);
    }

    // 6. Consultar el perfil con los valores recalculados por el trigger de base de datos
    const { data: updatedProfile, error: reloadError } = await supabase
      .from('professional_profiles')
      .select('*, user:users!professional_profiles_user_id_fkey(id, full_name, avatar_url, zone_id), oficio:oficios(*)')
      .eq('id', profileId)
      .single();

    if (reloadError || !updatedProfile) {
      throw new AppError('Error al recuperar el perfil actualizado tras el visto bueno', 500);
    }

    return {
      profile: updatedProfile as unknown as Tables<'professional_profiles'>,
      vouch,
    };
  }

  /**
   * Remueve un visto bueno previamente otorgado.
   */
  public async removeVouch(
    supabase: SupabaseClient<Database>,
    voucherUserId: string,
    profileId: string
  ): Promise<{ profile: Tables<'professional_profiles'> }> {
    const { error: deleteError } = await supabase
      .from('vouches')
      .delete()
      .eq('profile_id', profileId)
      .eq('voucher_user_id', voucherUserId);

    if (deleteError) {
      throw new AppError(`Error al remover visto bueno: ${deleteError.message}`, 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from('professional_profiles')
      .select('*, user:users!professional_profiles_user_id_fkey(id, full_name, avatar_url, zone_id), oficio:oficios(*)')
      .eq('id', profileId)
      .single();

    if (profileError || !profile) {
      throw new AppError('Error al consultar el perfil actualizado', 500);
    }

    return { profile: profile as unknown as Tables<'professional_profiles'> };
  }

  /**
   * Verifica si el usuario actual ha otorgado visto bueno al perfil.
   */
  public async hasVouched(
    supabase: SupabaseClient<Database>,
    voucherUserId: string,
    profileId: string
  ): Promise<boolean> {
    const { count, error } = await supabase
      .from('vouches')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .eq('voucher_user_id', voucherUserId);

    if (error) {
      return false;
    }

    return (count ?? 0) > 0;
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
