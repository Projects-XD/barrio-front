import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/database.types';
import { AppError } from '../middlewares/errorHandler';
import {
  createFavorSchema,
  createEmergencyReportSchema,
  createVouchSchema,
  type SyncOperationDTO,
} from '../utils/validators';
import { logger } from '../utils/logger';
import { assertProfileInUserZone, resolveUserZone } from './zoneAccess';

export interface SyncProcessResult {
  client_id: string;
  operation: string;
  status: 'enviado' | 'error';
  ignored?: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

// Aplica a las operaciones offline las mismas reglas de validación que los endpoints REST.
type PayloadParser<T> = {
  safeParse(data: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
};

function parseSyncPayload<T>(schema: PayloadParser<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.map(String).join('.') || 'payload'}: ${i.message}`)
      .join('; ');
    throw new AppError(`Payload inválido: ${detail}`, 400);
  }
  return result.data;
}

export class SyncService {
  /**
   * Procesa secuencialmente una lista de operaciones offline.
   * REGLA DE IDEMPOTENCIA:
   * Antes de ejecutar cada operación:
   * 1. Consulta si client_id ya existe en sync_operations para ese user_id.
   * 2. Si ya existe y está 'enviado', se ignora y se retorna con status 'enviado'.
   * 3. Si no existe, se guarda en sync_operations con status 'pendiente',
   *    se ejecuta la inserción real y finalmente se marca como 'enviado'.
   */
  public async processSyncBatch(
    supabase: SupabaseClient<Database>,
    userId: string,
    operations: SyncOperationDTO[]
  ): Promise<SyncProcessResult[]> {
    const results: SyncProcessResult[] = [];

    logger.info(`Iniciando procesamiento de sincronización offline para usuario ${userId}`, {
      totalOperations: operations.length,
    });

    // Procesamiento estrictamente secuencial
    for (const item of operations) {
      try {
        // 1. REGLA DE IDEMPOTENCIA: Verificar existencia previa en sync_operations
        const { data: existingOp } = await supabase
          .from('sync_operations')
          .select('*')
          .eq('user_id', userId)
          .eq('client_id', item.client_id)
          .maybeSingle();

        if (existingOp && existingOp.status === 'enviado') {
          logger.debug(`Operación omitida por idempotencia previa: ${item.client_id}`);
          results.push({
            client_id: item.client_id,
            operation: item.operation,
            status: 'enviado',
            ignored: true,
            message: 'Operación previamente procesada e idempotente',
          });
          continue;
        }

        // 2. Si no existe, registrar en sync_operations como 'pendiente'
        let opId = existingOp?.id;

        if (!opId) {
          const { data: newOp, error: insertOpErr } = await supabase
            .from('sync_operations')
            .insert({
              user_id: userId,
              client_id: item.client_id,
              operation: item.operation,
              payload: (item.payload as any) ?? {},
              status: 'pendiente',
            })
            .select('id')
            .single();

          if (insertOpErr) {
            // Manejo de condición de carrera con clave única (user_id, client_id)
            if (insertOpErr.code === '23505') {
              const { data: raceOp } = await supabase
                .from('sync_operations')
                .select('*')
                .eq('user_id', userId)
                .eq('client_id', item.client_id)
                .single();

              if (raceOp && raceOp.status === 'enviado') {
                results.push({
                  client_id: item.client_id,
                  operation: item.operation,
                  status: 'enviado',
                  ignored: true,
                });
                continue;
              }
              opId = raceOp?.id;
            } else {
              throw new AppError(
                `Fallo al registrar operación en sync_operations: ${insertOpErr.message}`,
                400
              );
            }
          } else {
            opId = newOp.id;
          }
        }

        // 3. Ejecutar la inserción real en la entidad correspondiente
        let executionResult: unknown = null;

        try {
          switch (item.operation) {
            case 'create_favor': {
              executionResult = await this.executeCreateFavor(
                supabase,
                userId,
                item.client_id,
                parseSyncPayload(createFavorSchema, {
                  ...item.payload,
                  client_id: item.client_id,
                })
              );
              break;
            }
            case 'create_vulnerability_report':
            case 'create_report': {
              executionResult = await this.executeCreateVulnerabilityReport(
                supabase,
                userId,
                parseSyncPayload(createEmergencyReportSchema, item.payload)
              );
              break;
            }
            case 'create_vouch': {
              executionResult = await this.executeCreateVouch(
                supabase,
                userId,
                parseSyncPayload(createVouchSchema, item.payload)
              );
              break;
            }
            default: {
              throw new Error(`Operación no reconocida para sincronización: ${item.operation}`);
            }
          }

          // 4. Marcar como 'enviado' de forma exitosa
          await supabase
            .from('sync_operations')
            .update({
              status: 'enviado',
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              error_message: null,
            })
            .eq('user_id', userId)
            .eq('client_id', item.client_id);

          results.push({
            client_id: item.client_id,
            operation: item.operation,
            status: 'enviado',
            data: executionResult,
          });
        } catch (execErr: any) {
          // Si falla la inserción real, persistir el error en sync_operations
          const errorMsg = execErr.message || 'Error durante la ejecución de la operación';
          logger.error(`Error procesando operación ${item.operation} (${item.client_id}):`, {
            error: errorMsg,
          });

          await supabase
            .from('sync_operations')
            .update({
              status: 'error',
              error_message: errorMsg,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            .eq('client_id', item.client_id);

          results.push({
            client_id: item.client_id,
            operation: item.operation,
            status: 'error',
            error: errorMsg,
          });
        }
      } catch (fatalErr: any) {
        results.push({
          client_id: item.client_id,
          operation: item.operation,
          status: 'error',
          error: fatalErr.message || 'Fallo general en la operación',
        });
      }
    }

    return results;
  }

  /**
   * Inserción real para 'create_favor'
   */
  private async executeCreateFavor(
    supabase: SupabaseClient<Database>,
    userId: string,
    clientId: string,
    payload: any
  ): Promise<Tables<'favors'>> {
    // Verificar si ya existe en favors (idempotencia interna por client_id)
    const { data: existing } = await supabase
      .from('favors')
      .select('*')
      .eq('author_id', userId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    // Después de la idempotencia: un reintento de algo ya creado no debe fallar por zona.
    const zoneId = await resolveUserZone(supabase, userId, payload.zone_id);

    const { data, error } = await supabase
      .from('favors')
      .insert({
        author_id: userId,
        client_id: clientId,
        zone_id: zoneId,
        type: payload.type,
        title: payload.title,
        description: payload.description ?? null,
        location_lat: payload.location_lat ?? null,
        location_lng: payload.location_lng ?? null,
        status: 'abierta',
        sync_status: 'enviado',
        urgency: payload.urgency,
        moderation_status: 'aprobado',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: dup } = await supabase
          .from('favors')
          .select('*')
          .eq('author_id', userId)
          .eq('client_id', clientId)
          .single();
        if (dup) return dup;
      }
      throw new AppError(`Error al insertar favor en sincronización: ${error.message}`, 400);
    }

    return data;
  }

  /**
   * Inserción real para reportes de vulnerabilidad (con redondeo de 3 decimales)
   */
  private async executeCreateVulnerabilityReport(
    supabase: SupabaseClient<Database>,
    userId: string,
    payload: any
  ): Promise<Record<string, unknown>> {
    // La idempotencia de reportes ya se resolvió con sync_operations en processSyncBatch.
    const zoneId = await resolveUserZone(supabase, userId, payload.zone_id);

    const rawLat = payload.lat ?? payload.approx_lat;
    const rawLng = payload.lng ?? payload.approx_lng;

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
        reporter_user_id: userId,
        zone_id: zoneId,
        approx_lat,
        approx_lng,
        description: payload.description,
        needs: payload.needs || [],
        status: 'activo',
        is_anonymous: Boolean(payload.is_anonymous),
      })
      .select()
      .single();

    if (error) {
      throw new AppError(`Error al insertar reporte en sincronización: ${error.message}`, 400);
    }

    if (data.is_anonymous) {
      const copy: Record<string, unknown> = { ...data };
      delete copy.reporter_user_id;
      return copy;
    }

    return data as Record<string, unknown>;
  }

  /**
   * Inserción real para visto bueno (vouch)
   */
  private async executeCreateVouch(
    supabase: SupabaseClient<Database>,
    userId: string,
    payload: any
  ): Promise<Tables<'vouches'>> {
    if (!payload.profile_id) {
      throw new AppError('profile_id es requerido para registrar visto bueno', 400);
    }

    const { data: existing } = await supabase
      .from('vouches')
      .select('*')
      .eq('voucher_user_id', userId)
      .eq('profile_id', payload.profile_id)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    await assertProfileInUserZone(supabase, userId, payload.profile_id);

    const { data, error } = await supabase
      .from('vouches')
      .insert({
        voucher_user_id: userId,
        profile_id: payload.profile_id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: dup } = await supabase
          .from('vouches')
          .select('*')
          .eq('voucher_user_id', userId)
          .eq('profile_id', payload.profile_id)
          .single();
        if (dup) return dup;
      }
      throw new AppError(`Error al insertar visto bueno en sincronización: ${error.message}`, 400);
    }

    return data;
  }
}

export const syncService = new SyncService();
