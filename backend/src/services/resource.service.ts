import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/database.types';
import { AppError } from '../middlewares/errorHandler';
import type { CreateCriticalResourceDTO } from '../utils/validators';

export class ResourceService {
  public async listResources(
    supabase: SupabaseClient<Database>,
    params: { zoneId: string; kind?: string }
  ): Promise<Tables<'critical_resources'>[]> {
    let query = supabase
      .from('critical_resources')
      .select('*, user:users(id, full_name)')
      .eq('zone_id', params.zoneId)
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

  public async createResource(
    supabase: SupabaseClient<Database>,
    userId: string,
    dto: CreateCriticalResourceDTO
  ): Promise<Tables<'critical_resources'>> {
    const { data, error } = await supabase
      .from('critical_resources')
      .insert({
        user_id: userId,
        zone_id: dto.zone_id ?? null,
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
