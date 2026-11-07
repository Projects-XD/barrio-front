import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/database.types';
import { AppError } from '../middlewares/errorHandler';
import type { CreateCriticalResourceDTO } from '../utils/validators';
import { resolveUserZone } from './zoneAccess';

export class ResourceService {
  /**
   * REGLA DE ZONA: siempre filtra por la zona del usuario; 403 si pidió otra.
   */
  public async listResources(
    supabase: SupabaseClient<Database>,
    userId: string,
    params: { zoneId?: string; kind?: string }
  ): Promise<Tables<'critical_resources'>[]> {
    const zoneId = await resolveUserZone(supabase, userId, params.zoneId);

    let query = supabase
      .from('critical_resources')
      .select('*, user:users(id, full_name)')
      .eq('zone_id', zoneId)
      .eq('status', 'abierto')
      .order('created_at', { ascending: false });

    if (params.kind) {
      query = query.eq('kind', params.kind as Tables<'critical_resources'>['kind']);
    }

    const { data, error } = await query;
    if (error) {
      throw new AppError(`Error al consultar recursos: ${error.message}`, 400);
    }

    return (data as unknown as Tables<'critical_resources'>[]) || [];
  }

  /**
   * REGLA DE ZONA: el recurso queda en la zona del usuario, sin importar el zone_id recibido.
   */
  public async createResource(
    supabase: SupabaseClient<Database>,
    userId: string,
    dto: CreateCriticalResourceDTO
  ): Promise<Tables<'critical_resources'>> {
    const zoneId = await resolveUserZone(supabase, userId);

    const { data, error } = await supabase
      .from('critical_resources')
      .insert({
        user_id: userId,
        zone_id: zoneId,
        kind: dto.kind,
        resource: dto.resource,
        quantity: dto.quantity ?? null,
        notes: dto.notes ?? null,
        status: dto.status ?? 'abierto',
      })
      .select()
      .single();

    if (error) {
      throw new AppError(`Error al registrar recurso crítico: ${error.message}`, 400);
    }

    return data;
  }
}

export const resourceService = new ResourceService();
