import { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database, Tables, OficioCategory } from '../types/database.types';
import { AppError } from '../middlewares/errorHandler';
import type { UpsertProfessionalProfileDTO, UpdateUserProfileDTO } from '../utils/validators';

const DEFAULT_OFICIOS: { category: OficioCategory; name: string }[] = [
  { category: 'gasfiteria', name: 'Gasfitería' },
  { category: 'carpinteria', name: 'Carpintería' },
  { category: 'electricidad', name: 'Electricidad' },
  { category: 'cerrajeria', name: 'Cerrajería' },
  { category: 'clases', name: 'Clases particulares' },
  { category: 'paseador_mascotas', name: 'Paseo de mascotas' },
  { category: 'otro', name: 'Otros oficios' },
];

export class ProfileService {
  /**
   * Garantiza que el usuario autenticado exista en public.users y tenga una zona asignada.
   */
  public async ensureUserRecord(
    supabase: SupabaseClient<Database>,
    userId: string,
    authUser?: User,
    fallbackZoneId?: string | null
  ): Promise<Tables<'users'>> {
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const metaZoneId =
      (typeof authUser?.user_metadata?.zone_id === 'string' && authUser.user_metadata.zone_id.trim()) ||
      null;
    const metaName =
      (typeof authUser?.user_metadata?.full_name === 'string' && authUser.user_metadata.full_name.trim()) ||
      authUser?.email?.split('@')[0] ||
      'Vecino';

    let targetZoneId = existing?.zone_id || metaZoneId || fallbackZoneId || null;

    if (!targetZoneId) {
      const { data: castillaZone } = await supabase
        .from('zones')
        .select('id')
        .ilike('name', '%Castilla%')
        .limit(1)
        .maybeSingle();

      if (castillaZone?.id) {
        targetZoneId = castillaZone.id;
      } else {
        const { data: anyZone } = await supabase
          .from('zones')
          .select('id')
          .order('name')
          .limit(1)
          .maybeSingle();
        targetZoneId = anyZone?.id ?? null;
      }
    }

    if (!existing) {
      const { data: created, error } = await supabase
        .from('users')
        .upsert({
          id: userId,
          full_name: metaName,
          zone_id: targetZoneId,
          status: 'active',
        })
        .select('*')
        .single();

      if (error || !created) {
        throw new AppError(`No se pudo sincronizar el usuario en el sistema: ${error?.message || ''}`, 400);
      }
      return created;
    }

    if (!existing.zone_id && targetZoneId) {
      const { data: updated } = await supabase
        .from('users')
        .update({ zone_id: targetZoneId, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('*')
        .single();

      if (updated) return updated;
    }

    return existing;
  }

  /**
   * Obtiene los datos del usuario actual en public.users (con su zona) y su perfil profesional.
   */
  public async getMyUserAndProfile(
    supabase: SupabaseClient<Database>,
    userId: string,
    authUser?: User
  ): Promise<{
    user: Tables<'users'> & { zone?: Tables<'zones'> | null };
    professionalProfile: Tables<'professional_profiles'> | null;
  }> {
    await this.ensureUserRecord(supabase, userId, authUser);

    const { data: userWithZone, error: userErr } = await supabase
      .from('users')
      .select('*, zone:zones(*)')
      .eq('id', userId)
      .single();

    if (userErr || !userWithZone) {
      throw new AppError('No se pudo obtener el perfil del usuario actual', 404);
    }

    const { data: profProfile } = await supabase
      .from('professional_profiles')
      .select('*, user:users!professional_profiles_user_id_fkey(id, full_name, avatar_url, zone_id), oficio:oficios(*)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      user: userWithZone as unknown as Tables<'users'> & { zone?: Tables<'zones'> | null },
      professionalProfile: (profProfile as unknown as Tables<'professional_profiles'>) ?? null,
    };
  }

  /**
   * Actualiza los datos del usuario autenticado (nombre, zona, rol de emergencia, etc.)
   * y sincroniza la zona de su perfil profesional si existe.
   */
  public async updateMyUser(
    supabase: SupabaseClient<Database>,
    userId: string,
    dto: UpdateUserProfileDTO,
    authUser?: User
  ): Promise<Tables<'users'> & { zone?: Tables<'zones'> | null }> {
    await this.ensureUserRecord(supabase, userId, authUser, dto.zone_id);

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        ...(dto.full_name !== undefined && { full_name: dto.full_name }),
        ...(dto.avatar_url !== undefined && { avatar_url: dto.avatar_url }),
        ...(dto.zone_id !== undefined && { zone_id: dto.zone_id }),
        ...(dto.is_anonymous_by_default !== undefined && {
          is_anonymous_by_default: dto.is_anonymous_by_default,
        }),
        ...(dto.emergency_role !== undefined && { emergency_role: dto.emergency_role }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('*, zone:zones(*)')
      .single();

    if (error || !updatedUser) {
      throw new AppError(`No se pudo actualizar el usuario: ${error?.message || ''}`, 400);
    }

    if (dto.zone_id) {
      await supabase
        .from('professional_profiles')
        .update({ zone_id: dto.zone_id, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    }

    return updatedUser as unknown as Tables<'users'> & { zone?: Tables<'zones'> | null };
  }

  /**
   * Crea o actualiza el perfil profesional de un usuario autenticado.
   * Si ya existe un perfil para la dupla (user_id, oficio_id), actualiza los datos;
   * de lo contrario, inserta un nuevo registro.
   */
  public async upsertProfile(
    supabase: SupabaseClient<Database>,
    userId: string,
    dto: UpsertProfessionalProfileDTO,
    authUser?: User
  ): Promise<Tables<'professional_profiles'>> {
    const userRecord = await this.ensureUserRecord(supabase, userId, authUser, dto.zone_id);
    const effectiveZoneId = dto.zone_id ?? userRecord.zone_id ?? null;

    // 1. Determinar si ya existe un perfil para este usuario
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
          zone_id: effectiveZoneId,
          description: dto.description ?? null,
          years_experience: dto.years_experience ?? 0,
          location_lat: dto.location_lat ?? null,
          location_lng: dto.location_lng ?? null,
          is_visible: dto.is_visible ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingId)
        .eq('user_id', userId)
        .select('*, user:users!professional_profiles_user_id_fkey(id, full_name, avatar_url, zone_id), oficio:oficios(*)')
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
        zone_id: effectiveZoneId,
        description: dto.description ?? null,
        years_experience: dto.years_experience ?? 0,
        location_lat: dto.location_lat ?? null,
        location_lng: dto.location_lng ?? null,
        is_visible: dto.is_visible ?? true,
      })
      .select('*, user:users!professional_profiles_user_id_fkey(id, full_name, avatar_url, zone_id), oficio:oficios(*)')
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
    // Con !inner el filtro por oficios.category descarta perfiles; sin él solo deja oficio en null.
    const oficioEmbed = params.category ? 'oficio:oficios!inner(*)' : 'oficio:oficios(*)';

    let query = supabase
      .from('professional_profiles')
      .select(`*, user:users!professional_profiles_user_id_fkey(id, full_name, avatar_url, zone_id), ${oficioEmbed}`)
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
   * Recalcula explícitamente el número de vistos buenos (validated_count) y estado (is_validated)
   * para garantizar consistencia inmediata incluso si el trigger SQL no se ejecutó.
   */
  private async recalculateAndReloadProfile(
    supabase: SupabaseClient<Database>,
    profileId: string
  ): Promise<Tables<'professional_profiles'>> {
    const { count } = await supabase
      .from('vouches')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', profileId);

    const validatedCount = count ?? 0;

    await supabase
      .from('professional_profiles')
      .update({
        validated_count: validatedCount,
        is_validated: validatedCount >= 2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId);

    const { data: updatedProfile, error: reloadError } = await supabase
      .from('professional_profiles')
      .select('*, user:users!professional_profiles_user_id_fkey(id, full_name, avatar_url, zone_id), oficio:oficios(*)')
      .eq('id', profileId)
      .single();

    if (reloadError || !updatedProfile) {
      throw new AppError('Error al recuperar el perfil actualizado tras el visto bueno', 500);
    }

    return updatedProfile as unknown as Tables<'professional_profiles'>;
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
    profileId: string,
    authUser?: User
  ): Promise<{ profile: Tables<'professional_profiles'>; vouch: Tables<'vouches'> }> {
    // 1. Consultar el perfil profesional objetivo y su zone_id
    const { data: targetProfile, error: profileError } = await supabase
      .from('professional_profiles')
      .select('id, user_id, zone_id')
      .eq('id', profileId)
      .single();

    if (profileError || !targetProfile) {
      throw new AppError('Perfil profesional objetivo no encontrado', 404);
    }

    // 2. Validación de auto-vouching
    if (targetProfile.user_id === voucherUserId) {
      throw new AppError('No puedes otorgarte un visto bueno a tu propio perfil profesional', 400);
    }

    // 3. Asegurar que el usuario votante exista en public.users y tenga zona asignada
    const voucherUser = await this.ensureUserRecord(
      supabase,
      voucherUserId,
      authUser,
      targetProfile.zone_id
    );

    if (!voucherUser.zone_id) {
      throw new AppError(
        'Debes pertenecer a una zona vecinal registrada para otorgar vistos buenos',
        403
      );
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

    // 6. Recalcular y consultar el perfil actualizado
    const updatedProfile = await this.recalculateAndReloadProfile(supabase, profileId);

    return {
      profile: updatedProfile,
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

    const profile = await this.recalculateAndReloadProfile(supabase, profileId);

    return { profile };
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
   * Si el catálogo aún está vacío en la base de datos, lo inicializa automáticamente.
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

    if (data && data.length > 0) {
      return data;
    }

    // Sembrar oficios base si la tabla está vacía
    const { data: inserted } = await supabase
      .from('oficios')
      .insert(DEFAULT_OFICIOS.map((o) => ({ ...o, is_active: true })))
      .select('*');

    return inserted || [];
  }
}

export const profileService = new ProfileService();
