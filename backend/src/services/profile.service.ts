import { randomUUID } from 'node:crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, OficioCategory } from '../types/database.types';
import { AppError, dbError } from '../middlewares/errorHandler';
import type { SaveMyLocationDTO, UpsertProfessionalProfileDTO } from '../utils/validators';
import { resolveUserZone } from './zoneAccess';
import { isWithinCastilla } from '../utils/castilla';
import { supabaseAdmin } from '../config/supabase';

export class ProfileService {
  /**
   * Guarda la ubicación del vecino en su cuenta y en sus perfiles profesionales.
   * La ubicación se escribe con service_role, así que el cliente nunca toca user_metadata.
   * Solo se acepta un punto dentro de Castilla.
   */
  public async saveUserLocation(userId: string, dto: SaveMyLocationDTO): Promise<SaveMyLocationDTO> {
    if (!isWithinCastilla({ lat: dto.lat, lng: dto.lng })) {
      throw new AppError('La ubicación debe estar dentro del distrito de Castilla.', 400);
    }

    const { data: current, error: getError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getError || !current.user) {
      throw new AppError('No se encontró tu cuenta.', 404);
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...current.user.user_metadata,
        location_lat: dto.lat,
        location_lng: dto.lng,
        location_address: dto.address.trim(),
      },
    });
    if (authError) {
      throw new AppError('No se pudo guardar tu ubicación.', 500);
    }

    const { error: profileError } = await supabaseAdmin
      .from('professional_profiles')
      .update({ location_lat: dto.lat, location_lng: dto.lng, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (profileError) {
      throw dbError('Error al actualizar la ubicación de tus oficios', profileError);
    }

    return { lat: dto.lat, lng: dto.lng, address: dto.address.trim() };
  }

  /**
   * Crea o actualiza el perfil profesional de un usuario autenticado.
   * Si ya existe un perfil para la dupla (user_id, oficio_id), actualiza los datos;
   * de lo contrario, inserta un nuevo registro.
   * REGLA DE ZONA: el perfil queda en la zona del usuario, sin importar el zone_id recibido.
   * Así nadie puede mudar su perfil a otra zona para recibir vistos buenos de allí.
   */
  public async upsertProfile(
    supabase: SupabaseClient<Database>,
    userId: string,
    dto: UpsertProfessionalProfileDTO
  ): Promise<Tables<'professional_profiles'>> {
    const zoneId = await resolveUserZone(supabase, userId);

    if (
      dto.location_lat != null &&
      dto.location_lng != null &&
      !isWithinCastilla({ lat: dto.location_lat, lng: dto.location_lng })
    ) {
      throw new AppError('La ubicación debe estar dentro del distrito de Castilla.', 400);
    }

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

    // 2. Si existe, actualizamos (preservando location_lat/lng si no se envían en el DTO)
    if (existingId) {
      const updatePayload: Database['public']['Tables']['professional_profiles']['Update'] = {
        oficio_id: dto.oficio_id,
        zone_id: zoneId,
        description: dto.description ?? null,
        years_experience: dto.years_experience ?? 0,
        is_visible: dto.is_visible ?? true,
        updated_at: new Date().toISOString(),
      };
      if (dto.location_lat !== undefined) updatePayload.location_lat = dto.location_lat;
      if (dto.location_lng !== undefined) updatePayload.location_lng = dto.location_lng;

      const { data, error } = await supabase
        .from('professional_profiles')
        .update(updatePayload)
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

    // 3. Si no existe, heredar ubicación de otro oficio del mismo usuario si no se envió
    let inheritedLat = dto.location_lat ?? null;
    let inheritedLng = dto.location_lng ?? null;
    if (inheritedLat === null || inheritedLng === null) {
      const { data: prevWithLoc } = await supabase
        .from('professional_profiles')
        .select('location_lat, location_lng')
        .eq('user_id', userId)
        .not('location_lat', 'is', null)
        .not('location_lng', 'is', null)
        .limit(1)
        .maybeSingle();
      if (prevWithLoc) {
        inheritedLat = prevWithLoc.location_lat;
        inheritedLng = prevWithLoc.location_lng;
      }
    }

    const { data, error } = await supabase
      .from('professional_profiles')
      .insert({
        user_id: userId,
        oficio_id: dto.oficio_id,
        zone_id: zoneId,
        description: dto.description ?? null,
        years_experience: dto.years_experience ?? 0,
        location_lat: inheritedLat,
        location_lng: inheritedLng,
        is_visible: dto.is_visible ?? true,
      })
      .select('*, oficio:oficios(*)')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new AppError('Ya tienes un perfil registrado para este oficio', 409);
      }
      throw dbError('Error al crear perfil profesional', error);
    }

    return data as unknown as Tables<'professional_profiles'>;
  }

  /**
   * Obtiene la lista de perfiles profesionales de la zona del usuario y opcionalmente oficio_id o category.
   * REGLA DE ZONA: siempre la zona real del usuario; cualquier zoneId que mande el cliente se ignora.
   */
  public async listProfiles(
    supabase: SupabaseClient<Database>,
    userId: string,
    params: { oficioId?: string; category?: OficioCategory }
  ): Promise<Tables<'professional_profiles'>[]> {
    const zoneId = await resolveUserZone(supabase, userId);

    // Con !inner el filtro por oficios.category descarta perfiles; sin él solo deja oficio en null.
    const oficioColumns = 'id, category, name, is_active';
    const oficioEmbed = params.category ? `oficio:oficios!inner(${oficioColumns})` : `oficio:oficios(${oficioColumns})`;

    let query = supabase
      .from('professional_profiles')
      .select(`*, user:users!professional_profiles_user_id_fkey(id, full_name, avatar_url, zone_id), ${oficioEmbed}`)
      .eq('zone_id', zoneId)
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
      throw dbError('Error al consultar perfiles', error);
    }

    return (data as unknown as Tables<'professional_profiles'>[]) || [];
  }

  /**
   * Obtiene el detalle de un perfil profesional por su identificador UUID.
   * REGLA DE ZONA: solo su dueño o un vecino de la misma zona pueden verlo.
   */
  public async getProfileById(
    supabase: SupabaseClient<Database>,
    userId: string,
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

    if (data.user_id !== userId && data.zone_id !== (await resolveUserZone(supabase, userId))) {
      throw new AppError('Acceso denegado: este perfil no pertenece a tu zona', 403);
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
      throw dbError('Error al registrar visto bueno', insertError);
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
      throw dbError('Error al remover visto bueno', deleteError);
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
      throw dbError('Error al obtener oficios', error);
    }

    return data || [];
  }

  /**
   * Elimina un perfil profesional propio del usuario autenticado.
   */
  public async deleteProfile(
    supabase: SupabaseClient<Database>,
    userId: string,
    profileId: string
  ): Promise<{ id: string }> {
    const { data: existing, error: findErr } = await supabase
      .from('professional_profiles')
      .select('id, user_id')
      .eq('id', profileId)
      .single();

    if (findErr || !existing) {
      throw new AppError('Oficio no encontrado', 404);
    }

    if (existing.user_id !== userId) {
      throw new AppError('No tienes permiso para eliminar este oficio', 403);
    }

    const { error: deleteErr } = await supabase
      .from('professional_profiles')
      .delete()
      .eq('id', profileId)
      .eq('user_id', userId);

    if (deleteErr) {
      throw dbError('No se pudo eliminar el oficio', deleteErr);
    }

    return { id: profileId };
  }

  /**
   * Inicia o recupera una conversación directa con un oficio comunitario.
   * Si ya existe un chat activo entre ambos vecinos para coordinar el trabajo, lo reutiliza.
   * Si no, crea un favor de coordinación y abre la conversación con un mensaje inicial.
   */
  public async contactProfile(
    supabase: SupabaseClient<Database>,
    clientUserId: string,
    profileId: string,
    initialMessage?: string
  ): Promise<{ conversation_id: string; is_new: boolean }> {
    const { data: clientUser, error: clientError } = await supabase
      .from('users')
      .select('id, full_name, zone_id')
      .eq('id', clientUserId)
      .single();

    if (clientError || !clientUser) {
      throw new AppError('Usuario no encontrado', 404);
    }

    const { data: targetProfile, error: profileError } = await supabase
      .from('professional_profiles')
      .select('id, user_id, zone_id, oficio:oficios(id, name, category), user:users(id, full_name)')
      .eq('id', profileId)
      .single();

    if (profileError || !targetProfile) {
      throw new AppError('Perfil profesional no encontrado', 404);
    }

    if (targetProfile.user_id === clientUserId) {
      throw new AppError('No puedes contactarte a ti mismo', 400);
    }

    // Verificar bloqueos mutuos
    const { data: block } = await supabase
      .from('user_blocks')
      .select('id')
      .or(`and(blocker_id.eq.${targetProfile.user_id},blocked_id.eq.${clientUserId}),and(blocker_id.eq.${clientUserId},blocked_id.eq.${targetProfile.user_id})`)
      .maybeSingle();

    if (block) {
      throw new AppError('No puedes contactar a este vecino', 403);
    }

    // Buscar si ya existe una conversación abierta entre ambos vecinos
    const { data: existingConvs } = await supabase
      .from('conversations')
      .select('id, closed_at, favor_id, favor:favors(id, title, status)')
      .or(`and(author_id.eq.${clientUserId},responder_id.eq.${targetProfile.user_id}),and(author_id.eq.${targetProfile.user_id},responder_id.eq.${clientUserId})`)
      .is('closed_at', null)
      .order('created_at', { ascending: false });

    const openConv = existingConvs?.find((c) => {
      const f = c.favor as unknown as { status: string; title: string } | null;
      return f && f.status !== 'cerrada';
    });

    if (openConv) {
      return { conversation_id: openConv.id, is_new: false };
    }

    const oficioName = (targetProfile.oficio as unknown as { name: string } | null)?.name ?? 'Oficio';
    const proName = (targetProfile.user as unknown as { full_name: string } | null)?.full_name ?? 'técnico del barrio';
    const zoneId = clientUser.zone_id ?? targetProfile.zone_id;

    // Crear el favor de coordinación vecinal
    const { data: newFavor, error: favorErr } = await supabaseAdmin
      .from('favors')
      .insert({
        client_id: randomUUID(),
        author_id: clientUserId,
        title: `Coordinación: ${oficioName}`,
        description: `Contacto vecinal para solicitar servicio o presupuesto de ${oficioName} a ${proName}.`,
        type: 'otros',
        intent: 'pedir',
        status: 'abierta',
        zone_id: zoneId,
        moderation_status: 'aprobado',
      })
      .select('id')
      .single();

    if (favorErr || !newFavor) {
      throw dbError('Error al crear la coordinación del servicio', favorErr);
    }

    // Abrir conversación
    const { data: newConv, error: convErr } = await supabaseAdmin
      .from('conversations')
      .insert({
        favor_id: newFavor.id,
        author_id: clientUserId,
        responder_id: targetProfile.user_id,
      })
      .select('id')
      .single();

    if (convErr || !newConv) {
      throw dbError('Error al abrir la conversación con el vecino', convErr);
    }

    // Mensaje inicial
    const body =
      initialMessage?.trim() ||
      `Hola ${proName}, te escribo desde tu perfil de ${oficioName} en Barrio para coordinar un trabajo.`;

    await supabaseAdmin.from('messages').insert({
      conversation_id: newConv.id,
      sender_id: clientUserId,
      body,
    });

    // Notificación al profesional
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: targetProfile.user_id,
        type: 'nuevo_mensaje',
        payload: {
          conversation_id: newConv.id,
          favor_id: newFavor.id,
          favor_title: `Coordinación: ${oficioName}`,
          sender_name: clientUser.full_name,
          count: 1,
          mensajes: [body.length > 120 ? body.slice(0, 119) + '…' : body],
        },
      });
    } catch {
      // Ignorar fallo de notificación secundaria
    }

    return { conversation_id: newConv.id, is_new: true };
  }
}

export const profileService = new ProfileService();
