import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/database.types';
import { AppError } from '../middlewares/errorHandler';
import type { ToggleEmergencyStateDTO } from '../utils/validators';

export class EmergencyService {
  /**
   * Obtiene el estado actual de emergencia de una zona.
   */
  public async getEmergencyState(
    supabase: SupabaseClient<Database>,
    zoneId: string
  ): Promise<Tables<'emergency_states'> | null> {
    const { data, error } = await supabase
      .from('emergency_states')
      .select('*')
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
   * Activa o desactiva el estado de emergencia para una zona.
   */
  public async setEmergencyState(
    supabase: SupabaseClient<Database>,
    userId: string,
    dto: ToggleEmergencyStateDTO
  ): Promise<Tables<'emergency_states'>> {
    const { data, error } = await supabase
      .from('emergency_states')
      .insert({
        zone_id: dto.zone_id,
        status: dto.status,
        activated_by_user_id: userId,
        reason: dto.reason,
        activated_at: new Date().toISOString(),
        deactivated_at: dto.status === 'inactiva' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      throw new AppError(`Error al cambiar estado de emergencia: ${error.message}`, 400);
    }

    return data;
  }

  /**
   * Lista los servicios de apoyo vecinales e institucionales en una zona.
   */
  public async listSupportServices(
    supabase: SupabaseClient<Database>,
    zoneId: string
  ): Promise<Tables<'support_services'>[]> {
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
