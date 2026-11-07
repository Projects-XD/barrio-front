export type UserStatus = 'active' | 'suspended' | 'deleted';
export type OficioCategory =
  | 'gasfiteria'
  | 'carpinteria'
  | 'electricidad'
  | 'cerrajeria'
  | 'clases'
  | 'paseador_mascotas'
  | 'otro';
export type FavorType =
  | 'herramienta'
  | 'ayuda_temporal'
  | 'donacion_materiales'
  | 'intercambio_habilidades'
  | 'movilidad_solidaria'
  | 'otros';
export type FavorStatus = 'abierta' | 'en_curso' | 'cerrada' | 'cancelada';
export type FavorUrgency = 'normal' | 'urgente' | 'emergencia';
export type ModerationStatus = 'pendiente' | 'aprobado' | 'rechazado';
export type SyncStatus = 'pendiente' | 'enviado' | 'error';
export type EmergencyStatus = 'inactiva' | 'activa';
export type ServiceType = 'salud' | 'bomberos' | 'policia' | 'grupo_apoyo' | 'refugio' | 'otro';
export type ResourceType = 'agua' | 'medicinas' | 'generador' | 'transporte' | 'alimentos' | 'otro';
export type ResourceKind = 'pedido' | 'oferta';
export type ReportStatus = 'activo' | 'resuelto' | 'oculto';
export type NotificationType =
  | 'visto_bueno_recibido'
  | 'interes_en_favor'
  | 'reporte_actualizado'
  | 'emergencia_activada'
  | 'sistema';
