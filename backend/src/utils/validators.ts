import type { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

/**
 * Middleware de orden superior para validar datos de la solicitud HTTP con esquemas Zod.
 * @param schema Esquema Zod a validar
 * @param source Origen de los datos ('body', 'query', 'params')
 */
export function validate<T>(
  schema: ZodSchema<T>,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const dataToValidate = req[source];
      const parsed = schema.parse(dataToValidate);
      req[source] = parsed;
      next();
    } catch (error) {
      next(error);
    }
  };
}

// ============================================================================
// ESQUEMAS ENUM (Sincronizados con PostgreSQL)
// ============================================================================

export const userStatusSchema = z.enum(['active', 'suspended', 'deleted']);

export const oficioCategorySchema = z.enum([
  'gasfiteria',
  'carpinteria',
  'electricidad',
  'cerrajeria',
  'clases',
  'paseador_mascotas',
  'otro',
]);

export const favorTypeSchema = z.enum([
  'herramienta',
  'ayuda_temporal',
  'donacion_materiales',
  'intercambio_habilidades',
  'movilidad_solidaria',
]);

export const favorStatusSchema = z.enum([
  'abierta',
  'en_curso',
  'cerrada',
  'cancelada',
]);

export const syncStatusSchema = z.enum(['pendiente', 'enviado', 'error']);

export const emergencyStatusSchema = z.enum(['inactiva', 'activa']);

export const serviceTypeSchema = z.enum([
  'salud',
  'bomberos',
  'policia',
  'grupo_apoyo',
  'refugio',
  'otro',
]);

export const resourceTypeSchema = z.enum([
  'agua',
  'medicinas',
  'generador',
  'transporte',
  'alimentos',
  'otro',
]);

export const resourceKindSchema = z.enum(['pedido', 'oferta']);

export const reportStatusSchema = z.enum(['activo', 'resuelto', 'oculto']);

export const reportReasonSchema = z.enum([
  'spam',
  'contenido_inapropiado',
  'datos_falsos',
  'acoso',
  'otro',
]);

export const notificationTypeSchema = z.enum([
  'visto_bueno_recibido',
  'interes_en_favor',
  'reporte_actualizado',
  'emergencia_activada',
  'sistema',
]);

// Coordenadas geográficas
export const latitudeSchema = z
  .number()
  .min(-90, 'Latitud mínima: -90')
  .max(90, 'Latitud máxima: 90');

export const longitudeSchema = z
  .number()
  .min(-180, 'Longitud mínima: -180')
  .max(180, 'Longitud máxima: 180');

// ============================================================================
// DTOs PARA PERFILES Y USUARIOS
// ============================================================================

export const updateUserProfileSchema = z.object({
  full_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  avatar_url: z.string().url('URL de avatar inválida').nullable().optional(),
  zone_id: z.string().uuid('zone_id debe ser un UUID válido').nullable().optional(),
  is_anonymous_by_default: z.boolean().optional(),
  emergency_role: z.boolean().optional(),
});
export type UpdateUserProfileDTO = z.infer<typeof updateUserProfileSchema>;

export const createProfessionalProfileSchema = z.object({
  oficio_id: z.string().uuid('oficio_id debe ser un UUID válido'),
  zone_id: z.string().uuid('zone_id debe ser un UUID válido').nullable().optional(),
  description: z
    .string()
    .max(500, 'La descripción no puede exceder 500 caracteres')
    .nullable()
    .optional(),
  years_experience: z
    .number()
    .int('Los años de experiencia deben ser enteros')
    .min(0, 'Los años de experiencia no pueden ser negativos')
    .nullable()
    .optional(),
  location_lat: latitudeSchema.nullable().optional(),
  location_lng: longitudeSchema.nullable().optional(),
  is_visible: z.boolean().default(true).optional(),
});
export type CreateProfessionalProfileDTO = z.infer<typeof createProfessionalProfileSchema>;

export const upsertProfessionalProfileSchema = z.object({
  id: z.string().uuid('id debe ser un UUID válido').optional(),
  oficio_id: z.string().uuid('oficio_id debe ser un UUID válido'),
  zone_id: z.string().uuid('zone_id debe ser un UUID válido').nullable().optional(),
  description: z
    .string()
    .max(500, 'La descripción no puede exceder 500 caracteres')
    .nullable()
    .optional(),
  years_experience: z
    .number()
    .int('Los años de experiencia deben ser enteros')
    .min(0, 'Los años de experiencia no pueden ser negativos')
    .nullable()
    .optional(),
  location_lat: latitudeSchema.nullable().optional(),
  location_lng: longitudeSchema.nullable().optional(),
  is_visible: z.boolean().default(true).optional(),
});
export type UpsertProfessionalProfileDTO = z.infer<typeof upsertProfessionalProfileSchema>;

export const listProfilesQuerySchema = z.object({
  zone_id: z.string().uuid('zone_id debe ser un UUID válido').optional(),
  zoneId: z.string().uuid('zoneId debe ser un UUID válido').optional(),
  oficio_id: z.string().uuid('oficio_id debe ser un UUID válido').optional(),
  oficioId: z.string().uuid('oficioId debe ser un UUID válido').optional(),
  category: oficioCategorySchema.optional(),
}).refine((data) => data.zone_id || data.zoneId, {
  message: 'El parámetro zone_id o zoneId es requerido',
  path: ['zone_id'],
});
export type ListProfilesQueryDTO = z.infer<typeof listProfilesQuerySchema>;

export const updateProfessionalProfileSchema = createProfessionalProfileSchema
  .omit({ oficio_id: true })
  .partial();
export type UpdateProfessionalProfileDTO = z.infer<typeof updateProfessionalProfileSchema>;

// ============================================================================
// DTOs PARA VOUCHES (Vistos Buenos)
// ============================================================================

export const createVouchSchema = z.object({
  profile_id: z.string().uuid('profile_id debe ser un UUID válido'),
});
export type CreateVouchDTO = z.infer<typeof createVouchSchema>;

// ============================================================================
// DTOs PARA FAVORES VECINALES
// ============================================================================

export const createFavorSchema = z.object({
  client_id: z.string().uuid('client_id debe ser un UUID válido para evitar duplicidad'),
  zone_id: z.string().uuid('zone_id debe ser un UUID válido').nullable().optional(),
  type: favorTypeSchema,
  title: z
    .string()
    .min(1, 'El título es obligatorio')
    .max(120, 'El título no puede exceder 120 caracteres'),
  description: z.string().nullable().optional(),
  location_lat: latitudeSchema.nullable().optional(),
  location_lng: longitudeSchema.nullable().optional(),
});
export type CreateFavorDTO = z.infer<typeof createFavorSchema>;

export const listFavorsQuerySchema = z.object({
  zone_id: z.string().uuid('zone_id debe ser un UUID válido').optional(),
  zoneId: z.string().uuid('zoneId debe ser un UUID válido').optional(),
  type: favorTypeSchema.optional(),
  status: favorStatusSchema.optional(),
}).refine((data) => data.zone_id || data.zoneId, {
  message: 'El parámetro zone_id o zoneId es requerido',
  path: ['zone_id'],
});
export type ListFavorsQueryDTO = z.infer<typeof listFavorsQuerySchema>;

export const updateFavorSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().nullable().optional(),
  type: favorTypeSchema.optional(),
  status: favorStatusSchema.optional(),
  assigned_to_user_id: z.string().uuid().nullable().optional(),
});
export type UpdateFavorDTO = z.infer<typeof updateFavorSchema>;

export const createFavorInterestSchema = z.object({
  message: z.string().max(500, 'El mensaje no puede exceder 500 caracteres').nullable().optional(),
});
export type CreateFavorInterestDTO = z.infer<typeof createFavorInterestSchema>;

// ============================================================================
// DTOs PARA REPORTES DE VULNERABILIDAD Y EMERGENCIAS
// ============================================================================

export const createVulnerabilityReportSchema = z.object({
  zone_id: z.string().uuid('zone_id debe ser un UUID válido').nullable().optional(),
  approx_lat: latitudeSchema.nullable().optional(),
  approx_lng: longitudeSchema.nullable().optional(),
  description: z.string().min(5, 'La descripción debe tener al menos 5 caracteres'),
  needs: z.array(z.string()).default([]),
  is_anonymous: z.boolean().default(false),
});
export type CreateVulnerabilityReportDTO = z.infer<typeof createVulnerabilityReportSchema>;

export const createCriticalResourceSchema = z.object({
  zone_id: z.string().uuid('zone_id debe ser un UUID válido').nullable().optional(),
  kind: resourceKindSchema,
  resource: resourceTypeSchema,
  quantity: z.number().positive('La cantidad debe ser mayor a 0').nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(['abierto', 'cubierto', 'cancelado']).default('abierto'),
});
export type CreateCriticalResourceDTO = z.infer<typeof createCriticalResourceSchema>;

export const toggleEmergencyStateSchema = z.object({
  zone_id: z.string().uuid('zone_id debe ser un UUID válido'),
  status: emergencyStatusSchema,
  reason: z.string().min(5, 'Se requiere un motivo explicativo para la emergencia'),
});
export type ToggleEmergencyStateDTO = z.infer<typeof toggleEmergencyStateSchema>;

export const activateEmergencySchema = z.object({
  zone_id: z.string().uuid('zone_id debe ser un UUID válido'),
  reason: z.string().min(3, 'Se requiere un motivo explicativo para activar la emergencia'),
});
export type ActivateEmergencyDTO = z.infer<typeof activateEmergencySchema>;

export const deactivateEmergencySchema = z.object({
  zone_id: z.string().uuid('zone_id debe ser un UUID válido'),
  reason: z.string().optional(),
});
export type DeactivateEmergencyDTO = z.infer<typeof deactivateEmergencySchema>;

export const createEmergencyReportSchema = z.object({
  zone_id: z.string().uuid('zone_id debe ser un UUID válido').nullable().optional(),
  lat: latitudeSchema.nullable().optional(),
  lng: longitudeSchema.nullable().optional(),
  approx_lat: latitudeSchema.nullable().optional(),
  approx_lng: longitudeSchema.nullable().optional(),
  description: z.string().min(5, 'La descripción debe tener al menos 5 caracteres'),
  needs: z.array(z.string()).default([]),
  is_anonymous: z.boolean().default(false),
});
export type CreateEmergencyReportDTO = z.infer<typeof createEmergencyReportSchema>;

// ============================================================================
// DTOs PARA MODERACIÓN Y SINCRONIZACIÓN
// ============================================================================

export const createUserReportSchema = z.object({
  target_type: z.string().min(1, 'target_type es requerido'),
  target_id: z.string().uuid('target_id debe ser un UUID válido'),
  reason: reportReasonSchema,
  details: z.string().nullable().optional(),
});
export type CreateUserReportDTO = z.infer<typeof createUserReportSchema>;

export const registerPushTokenSchema = z.object({
  token: z.string().min(1, 'El token push es requerido'),
  platform: z.enum(['ios', 'android', 'web']),
});
export type RegisterPushTokenDTO = z.infer<typeof registerPushTokenSchema>;

export const syncOperationSchema = z.object({
  client_id: z.string().uuid('client_id debe ser un UUID válido'),
  operation: z.string().min(1, 'operation es requerida'),
  payload: z.record(z.unknown()),
});
export type SyncOperationDTO = z.infer<typeof syncOperationSchema>;

export const syncBatchSchema = z.union([
  z.array(syncOperationSchema),
  z.object({
    operations: z.array(syncOperationSchema),
  }),
]);
export type SyncBatchDTO = z.infer<typeof syncBatchSchema>;

