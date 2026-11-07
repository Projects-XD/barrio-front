import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/database.types';
import { AppError } from '../middlewares/errorHandler';
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
   * REGLA DE SEGURIDAD: Verifica que req.user.id tenga emergency_role = true en `users`
   * y que la zona especificada sea la suya (403 si no).
   * Registra el estado de emergencia 'activa' para la zona especificada.
   */
  public async activateEmergency(
    supabase: SupabaseClient<Database>,
    userId: string,
    dto: ActivateEmergencyDTO
  ): Promise<Tables<'emergency_states'>> {
    await this.verifyEmergencyRole(supabase, userId);
    await resolveUserZone(supabase, userId, dto.zone_id);

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('emergency_states')
      .insert({
        zone_id: dto.zone_id,
        status: 'activa',
        activated_by_user_id: userId,
        reason: dto.reason,
        activated_at: now,
        deactivated_at: null,
      })
      .select()
      .single();

    if (error) {
      throw new AppError(`Error al activar estado de emergencia: ${error.message}`, 400);
    }

    return data;
  }

  /**
   * Endpoint POST /api/emergency/deactivate
   * REGLA DE SEGURIDAD: Verifica que req.user.id tenga emergency_role = true en `users`
   * y que la zona especificada sea la suya (403 si no).
   * Cierra las emergencias activas y registra el estado 'inactiva'.
   */
  public async deactivateEmergency(
    supabase: SupabaseClient<Database>,
    userId: string,
    dto: DeactivateEmergencyDTO
  ): Promise<Tables<'emergency_states'>> {
    await this.verifyEmergencyRole(supabase, userId);
    await resolveUserZone(supabase, userId, dto.zone_id);

    const now = new Date().toISOString();

    // 1. Actualizar registros activos previos de la zona
    await supabase
      .from('emergency_states')
      .update({
        status: 'inactiva',
        deactivated_at: now,
        updated_at: now,
      })
      .eq('zone_id', dto.zone_id)
      .eq('status', 'activa');

    // 2. Registrar el evento de desactivación
    const { data, error } = await supabase
      .from('emergency_states')
      .insert({
        zone_id: dto.zone_id,
        status: 'inactiva',
        activated_by_user_id: userId,
        reason: dto.reason || 'Emergencia finalizada por usuario autorizado',
        activated_at: now,
        deactivated_at: now,
      })
      .select()
      .single();

    if (error) {
      throw new AppError(`Error al desactivar estado de emergencia: ${error.message}`, 400);
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
      })
      .select()
      .single();

    if (error) {
      throw new AppError(`Error al crear reporte de vulnerabilidad: ${error.message}`, 400);
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
   * REGLA DE ZONA: siempre filtra por la zona del usuario; 403 si pidió otra.
   * REGLA DE PRIVACIDAD: Si en la DB `is_anonymous = true`, el JSON de respuesta
   * NO debe incluir `reporter_user_id` ni datos personales del reportante.
   */
  public async listReports(
    supabase: SupabaseClient<Database>,
    userId: string,
    requestedZoneId?: string
  ): Promise<Record<string, unknown>[]> {
    const zoneId = await resolveUserZone(supabase, userId, requestedZoneId);

    const { data, error } = await supabase
      .from('vulnerability_reports')
      .select('*, reporter:users!vulnerability_reports_reporter_user_id_fkey(id, full_name, avatar_url)')
      .eq('zone_id', zoneId)
      .eq('status', 'activo')
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError(`Error al consultar reportes de emergencia: ${error.message}`, 400);
    }

    // REGLA DE PRIVACIDAD: Sanitización estricta para reportes anónimos
    const sanitizedReports = (data || []).map((report: any) => {
      if (report.is_anonymous) {
        const copy: Record<string, unknown> = { ...report };
        delete copy.reporter_user_id;
        delete copy.reporter;
        return copy;
      }
      return report;
    });

    return sanitizedReports;
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
      throw new AppError(`Error al consultar estado de emergencia: ${error.message}`, 400);
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
      throw new AppError(`Error al obtener servicios de soporte: ${error.message}`, 400);
    }

    return data || [];
  }
}

export const emergencyService = new EmergencyService();
