import type { FavorStatus, FavorType, OficioCategory, ResourceType, ServiceType, SyncStatus } from '@/types';

export const oficioLabel: Record<OficioCategory, string> = {
  gasfiteria: 'Gasfitería',
  carpinteria: 'Carpintería',
  electricidad: 'Electricidad',
  cerrajeria: 'Cerrajería',
  clases: 'Clases',
  paseador_mascotas: 'Paseador de mascotas',
  otro: 'Otro',
};

export const favorTypeLabel: Record<FavorType, string> = {
  herramienta: 'Préstamo de herramienta',
  ayuda_temporal: 'Ayuda temporal',
  donacion_materiales: 'Donación de materiales',
  intercambio_habilidades: 'Intercambio de habilidades',
  movilidad_solidaria: 'Movilidad solidaria',
};

export const favorStatusLabel: Record<FavorStatus, string> = {
  abierta: 'Abierta',
  en_curso: 'En curso',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
};

export const syncStatusLabel: Record<SyncStatus, string> = {
  pendiente: 'Pendiente de envío',
  enviado: 'Enviado',
  error: 'Error al enviar',
};

export const resourceLabel: Record<ResourceType, string> = {
  agua: 'Agua',
  medicinas: 'Medicinas',
  generador: 'Generador',
  transporte: 'Transporte',
  alimentos: 'Alimentos',
  otro: 'Otro',
};

export const serviceLabel: Record<ServiceType, string> = {
  salud: 'Salud',
  bomberos: 'Bomberos',
  policia: 'Policía',
  grupo_apoyo: 'Grupo de apoyo',
  refugio: 'Refugio',
  otro: 'Otro',
};

export const favorTypeBackground: Record<FavorType, string> = {
  herramienta: '#E6EEF8',
  ayuda_temporal: '#F8ECE0',
  donacion_materiales: '#EEF5E3',
  intercambio_habilidades: '#F1E8F7',
  movilidad_solidaria: '#E3F4F2',
};
