import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/database.types';
import { AppError, dbError } from '../middlewares/errorHandler';
import type {
  ActivateEmergencyDTO,
  DeactivateEmergencyDTO,
  CreateEmergencyReportDTO,
  ToggleEmergencyStateDTO,
} from '../utils/validators';
import { resolveUserZone } from './zoneAccess';

export class EmergencyService {
  /**
   * REGLA DE SEGURIDAD:
   * Valida en la tabla `users` que el usuario posea `emergency_role = true`.
   * Si es false o no existe, lanza un error con HTTP 403 Forbidden.
   */
  private async verifyEmergencyRole(
    supabase: SupabaseClient<Database>,
    userId: string
  ): Promise<void> {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, emergency_role')
      .eq('id', userId)
      .maybeSingle();

    if (error || !user) {
      throw new AppError('Usuario no encontrado o no autorizado', 403);
    }

    if (!user.emergency_role) {
      throw new AppError(
        'Acceso denegado: Se requiere rol de emergencia (emergency_role = true) para gestionar este estado.',
        403
      );
    }
  }

  /**
   * Endpoint POST /api/emergency/activate
   * REGLA DE SEGURIDAD: Verifica que req.user.id tenga emergency_role = true en `users`.
   * Registra el estado de emergencia 'activa' para la zona real del usuario (se ignora
   * cualquier zone_id que venga en el body).
   */
  public async activateEmergency(
    supabase: SupabaseClient<Database>,
    userId: string,
    dto: ActivateEmergencyDTO
  ): Promise<Tables<'emergency_states'>> {
    await this.verifyEmergencyRole(supabase, userId);
    // resolveUserZone ya no valida el zone_id del body contra la zona real: ahora que siempre
    // devuelve la zona del usuario, hay que usar ese valor directamente en vez de dto.zone_id
    // para no activar una emergencia en una zona ajena.
    const zoneId = await resolveUserZone(supabase, userId);

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('emergency_states')
      .insert({
        zone_id: zoneId,
        status: 'activa',
        activated_by_user_id: userId,
        reason: dto.reason,
        activated_at: now,
        deactivated_at: null,
      })
      .select()
      .single();

    if (error) {
      throw dbError('Error al activar estado de emergencia', error);
    }

    return data;
  }

  /**
   * Endpoint POST /api/emergency/deactivate
   * REGLA DE SEGURIDAD: Verifica que req.user.id tenga emergency_role = true en `users`.
   * Cierra las emergencias activas de la zona real del usuario y registra el estado 'inactiva'
   * (se ignora cualquier zone_id que venga en el body).
   */
  public async deactivateEmergency(
    supabase: SupabaseClient<Database>,
    userId: string,
    dto: DeactivateEmergencyDTO
  ): Promise<Tables<'emergency_states'>> {
    await this.verifyEmergencyRole(supabase, userId);
    // Mismo motivo que en activateEmergency: se usa la zona real resuelta, no dto.zone_id.
    const zoneId = await resolveUserZone(supabase, userId);

    const now = new Date().toISOString();

    // 1. Actualizar registros activos previos de la zona
    await supabase
      .from('emergency_states')
      .update({
        status: 'inactiva',
        deactivated_at: now,
        updated_at: now,
      })
      .eq('zone_id', zoneId)
      .eq('status', 'activa');

    // 2. Registrar el evento de desactivación
    const { data, error } = await supabase
      .from('emergency_states')
      .insert({
        zone_id: zoneId,
        status: 'inactiva',
        activated_by_user_id: userId,
        reason: dto.reason || 'Emergencia finalizada por usuario autorizado',
        activated_at: now,
        deactivated_at: now,
      })
      .select()
      .single();

    if (error) {
      throw dbError('Error al desactivar estado de emergencia', error);
    }

    return data;
  }

  /**
   * Endpoint POST /api/emergency/reports (Reportar vulnerabilidad)
   * REGLA DE PRIVACIDAD: Toma req.body.lat y req.body.lng y los redondea
   * matemáticamente a 3 decimales (~111m de precisión) ANTES de insertar en vulnerability_reports.
   * REGLA DE ZONA: el reporte queda en la zona del usuario, sin importar el zone_id recibido.
   */
  public async createReport(
    supabase: SupabaseClient<Database>,
    reporterUserId: string,
    dto: CreateEmergencyReportDTO
  ): Promise<Record<string, unknown>> {
    const zoneId = await resolveUserZone(supabase, reporterUserId);

    const rawLat = dto.lat ?? dto.approx_lat;
    const rawLng = dto.lng ?? dto.approx_lng;

    // REGLA MATEMÁTICA: Redondeo estricto a 3 decimales
    const approx_lat =
      typeof rawLat === 'number' && !isNaN(rawLat)
        ? Math.round(rawLat * 1000) / 1000
        : null;

    const approx_lng =
      typeof rawLng === 'number' && !isNaN(rawLng)
        ? Math.round(rawLng * 1000) / 1000
        : null;

    const { data, error } = await supabase
      .from('vulnerability_reports')
      .insert({
        reporter_user_id: reporterUserId,
        zone_id: zoneId,
        approx_lat,
        approx_lng,
        description: dto.description,
        needs: dto.needs || [],
        status: 'activo',
        is_anonymous: Boolean(dto.is_anonymous),
        affected_name: dto.affected_name || null,
        location_detail: dto.location_detail || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '54000') throw new AppError(error.message, 429); // límite de reportes por hora
      throw dbError('Error al crear reporte de vulnerabilidad', error);
    }

    // REGLA DE PRIVACIDAD: Si el reporte es anónimo, nunca devolver reporter_user_id
    if (data.is_anonymous) {
      const responseData: Record<string, unknown> = { ...data };
      delete responseData.reporter_user_id;
      return responseData;
    }

    return data as Record<string, unknown>;
  }

  /**
   * Endpoint GET /api/emergency/reports
   * REGLA DE ZONA: siempre filtra por la zona real del usuario; cualquier zoneId que mande el
   * cliente se ignora.
   * REGLA DE PRIVACIDAD: Si en la DB `is_anonymous = true`, el JSON de respuesta
   * NO debe incluir `reporter_user_id` ni datos personales del reportante.
   */
  public async listReports(
    supabase: SupabaseClient<Database>,
    userId: string,
    page: { limit?: number; offset?: number } = {}
  ): Promise<{ items: Record<string, unknown>[]; total: number; can_resolve: boolean }> {
    const zoneId = await resolveUserZone(supabase, userId);
    const limit = Math.min(Math.max(Math.trunc(page.limit || 10), 1), 100);
    const offset = Math.max(Math.trunc(page.offset || 0), 0);

    const [{ data, error, count }, canResolve] = await Promise.all([
      supabase
        .from('vulnerability_reports')
        .select(
          '*, reporter:users!vulnerability_reports_reporter_user_id_fkey(id, full_name, avatar_url), responders:report_responders(user_id, user:users(id, full_name))',
          { count: 'exact' }
        )
        .eq('zone_id', zoneId)
        .eq('status', 'activo')
        // TTL: los vencidos no se listan aunque el job de pg_cron aún no los haya archivado.
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      this.canResolveReports(supabase, userId),
    ]);

    if (error) {
      throw dbError('Error al consultar reportes de emergencia', error);
    }

    // REGLA DE PRIVACIDAD: nombre y dirección exacta solo para quien reportó, los voluntarios del
    // reporte y el comité/admin. El resto recibe `detail_hidden` para saber que existen.
    // Sanitización estricta para reportes anónimos.
    const sanitizedReports = (data || []).map((report: any) => {
      const copy: Record<string, unknown> = { ...report };
      const puedeVerDetalle =
        canResolve ||
        report.reporter_user_id === userId ||
        (report.responders ?? []).some((x: { user_id: string }) => x.user_id === userId);
      if (!puedeVerDetalle) {
        copy.detail_hidden = Boolean(report.affected_name || report.location_detail);
        delete copy.affected_name;
        delete copy.location_detail;
      }
      copy.is_mine = report.reporter_user_id === userId; // antes de quitar reporter_user_id
      if (report.is_anonymous) {
        delete copy.reporter_user_id;
        delete copy.reporter;
      }
      return copy;
    });

    return { items: sanitizedReports, total: count ?? sanitizedReports.length, can_resolve: canResolve };
  }

  /**
   * Endpoint POST /api/emergency/reports/:id/attend ("Voy a ayudar").
   * Varios vecinos de la zona pueden acudir al mismo caso; avisa a quien reportó y a quienes ya iban.
   */
  public async attendReport(
    supabase: SupabaseClient<Database>,
    userId: string,
    reportId: string
  ): Promise<{ report_id: string; responders_count: number }> {
    const { data, error } = await supabase.rpc('fn_atender_reporte', {
      p_report_id: reportId,
      p_user_id: userId,
    });
    if (error) {
      if (error.code === 'P0002') throw new AppError('Reporte no encontrado o ya cerrado', 404);
      if (error.code === '42501') throw new AppError('No puedes atender tu propio reporte', 403);
      throw dbError('Error al tomar el reporte', error);
    }
    const row = data?.[0];
    if (!row) throw new AppError('Reporte no encontrado o ya cerrado', 404);
    return row;
  }

  /**
   * Endpoint POST /api/emergency/reports/:id/request-help ("Necesito más ayuda").
   * Solo quien ya acude; avisa al resto de la zona. Límite: una vez cada 5 minutos.
   */
  public async requestBackup(
    supabase: SupabaseClient<Database>,
    userId: string,
    reportId: string
  ): Promise<{ report_id: string; responders_count: number }> {
    const { data, error } = await supabase.rpc('fn_pedir_refuerzo', {
      p_report_id: reportId,
      p_user_id: userId,
    });
    if (error) {
      if (error.code === 'P0002') throw new AppError('Reporte no encontrado o ya cerrado', 404);
      if (error.code === '42501') throw new AppError('Solo quien está acudiendo puede pedir más ayuda', 403);
      if (error.code === '54000') throw new AppError('Ya pediste más ayuda hace poco; espera unos minutos', 429);
      throw dbError('Error al pedir más ayuda', error);
    }
    const row = data?.[0];
    if (!row) throw new AppError('Reporte no encontrado o ya cerrado', 404);
    return row;
  }

  /** Endpoint DELETE /api/emergency/reports/:id/attend ("Ya no puedo ir"): quita solo al propio vecino. */
  public async releaseReport(
    supabase: SupabaseClient<Database>,
    userId: string,
    reportId: string
  ): Promise<{ id: string }> {
    const { data, error } = await supabase.rpc('fn_soltar_reporte', {
      p_report_id: reportId,
      p_user_id: userId,
    });
    if (error) throw dbError('Error al soltar el reporte', error);
    if (!data) throw new AppError('No estás atendiendo este reporte', 404);
    return { id: reportId };
  }

  /** Admin o comité de emergencia (emergency_role) pueden resolver reportes; quien reportó, el suyo. */
  private async canResolveReports(supabase: SupabaseClient<Database>, userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('users')
      .select('is_admin, emergency_role')
      .eq('id', userId)
      .maybeSingle();
    return Boolean(data?.is_admin || data?.emergency_role);
  }

  /**
   * Endpoint PATCH /api/emergency/reports/:id/resolve
   * REGLA DE SEGURIDAD: admin/emergency_role (cualquier reporte de su zona) o quien reportó (solo el suyo).
   */
  public async resolveReport(
    supabase: SupabaseClient<Database>,
    userId: string,
    reportId: string
  ): Promise<{ id: string; status: string }> {
    const esComite = await this.canResolveReports(supabase, userId);
    const zoneId = await resolveUserZone(supabase, userId);

    let query = supabase
      .from('vulnerability_reports')
      .update({ status: 'resuelto', resolved_by_user_id: userId, resolved_at: new Date().toISOString() })
      .eq('id', reportId)
      .eq('zone_id', zoneId)
      .eq('status', 'activo');
    // Quien no es comité solo puede cerrar su propio reporte (por ejemplo, una falsa alarma).
    if (!esComite) query = query.eq('reporter_user_id', userId);
    const { data, error } = await query.select('id, status').maybeSingle();

    if (error) {
      throw dbError('Error al resolver el reporte', error);
    }
    if (!data) {
      throw new AppError('Reporte no encontrado o ya resuelto', 404);
    }
    return data;
  }

  /**
   * Obtiene el estado actual de emergencia de una zona.
   */
  public async getEmergencyState(
    supabase: SupabaseClient<Database>,
    zoneId: string
  ): Promise<Pick<Tables<'emergency_states'>, 'id' | 'zone_id' | 'status' | 'reason' | 'activated_at' | 'deactivated_at'> | null> {
    const { data, error } = await supabase
      .from('emergency_states')
      .select('id, zone_id, status, reason, activated_at, deactivated_at')
      .eq('zone_id', zoneId)
      .order('activated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw dbError('Error al consultar estado de emergencia', error);
    }

    return data;
  }

  /**
   * Método legacy para compatibilidad con endpoints anteriores.
   */
  public async setEmergencyState(
    supabase: SupabaseClient<Database>,
    userId: string,
    dto: ToggleEmergencyStateDTO
  ): Promise<Tables<'emergency_states'>> {
    if (dto.status === 'activa') {
      return this.activateEmergency(supabase, userId, {
        zone_id: dto.zone_id,
        reason: dto.reason,
      });
    } else {
      return this.deactivateEmergency(supabase, userId, {
        zone_id: dto.zone_id,
        reason: dto.reason,
      });
    }
  }

  /**
   * Lista los servicios de apoyo vecinales e institucionales en una zona.
   */
  public async listSupportServices(
    supabase: SupabaseClient<Database>,
    zoneId: string
  ): Promise<Tables<'support_services'>[]> {
    // zoneId va interpolado en el filtro .or(); validar que sea un UUID evita inyectar filtros.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(zoneId)) {
      throw new AppError('zone_id debe ser un UUID válido', 400);
    }

    const { data, error } = await supabase
      .from('support_services')
      .select('*')
      .or(`zone_id.eq.${zoneId},zone_id.is.null`)
      .order('is_verified', { ascending: false })
      .order('name');

    if (error) {
      throw dbError('Error al obtener servicios de soporte', error);
    }

    return data || [];
  }
}

export const emergencyService = new EmergencyService();
