import { api } from './client';
import type {
  FavorType,
  OficioCategory,
  ResourceKind,
  ResourceType,
  ServiceType,
} from '@/types';

// ============================================================================
// TIPOS DE RESPUESTA DEL BACKEND (claves snake_case de Postgres)
// ============================================================================

export interface BackendZone {
  id: string;
  name: string;
  city: string;
  center_lat: number | null;
  center_lng: number | null;
}

export interface BackendOficio {
  id: string;
  category: OficioCategory;
  name: string;
  is_active?: boolean;
}

export interface BackendProfile {
  id: string;
  user_id: string;
  oficio_id: string;
  zone_id: string | null;
  description: string | null;
  years_experience: number | null;
  location_lat?: number | null;
  location_lng?: number | null;
  is_visible: boolean;
  validated_count: number;
  is_validated: boolean;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    zone_id: string | null;
  } | null;
  oficio: BackendOficio | null;
}

export interface BackendFavor {
  id: string;
  author_id: string;
  zone_id: string | null;
  type: FavorType;
  title: string;
  description: string | null;
  status: 'abierta' | 'en_curso' | 'cerrada' | 'cancelada';
  client_id: string;
  sync_status: 'pendiente' | 'enviado' | 'error';
  created_at: string;
  location_lat?: number | null;
  location_lng?: number | null;
  author?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  interests?: { id: string; user_id: string }[];
}

export interface BackendEmergencyState {
  status: 'activa' | 'inactiva';
  reason: string | null;
  activated_at: string | null;
}

export interface BackendService {
  id: string;
  name: string;
  type: ServiceType;
  phone: string | null;
  address_summary: string | null;
  hours: string | null;
  is_verified: boolean;
}

export interface BackendReport {
  id: string;
  zone_id: string | null;
  approx_lat: number | null;
  approx_lng: number | null;
  description: string;
  needs: string[];
  status: 'activo' | 'resuelto' | 'oculto';
  is_anonymous: boolean;
  created_at: string;
  resolved_at: string | null;
  reporter?: { id: string; full_name: string } | null;
}

export interface BackendResource {
  id: string;
  kind: ResourceKind;
  resource: ResourceType;
  quantity: number | null;
  notes: string | null;
  status: 'abierto' | 'cubierto' | 'cancelado';
  user?: { id: string; full_name: string } | null;
}

// ============================================================================
// ZONAS (pública, la usa el registro)
// ============================================================================

export const listZones = () => api.get<BackendZone[]>('/zones');

// ============================================================================
// OFICIOS Y PERFILES
// ============================================================================

export const listOficios = () => api.get<BackendOficio[]>('/profiles/oficios');

export const listProfiles = (params: { zoneId: string; category?: OficioCategory }) => {
  const query = new URLSearchParams();
  query.set('zone_id', params.zoneId);
  if (params.category) query.set('category', params.category);
  return api.get<BackendProfile[]>(`/profiles?${query.toString()}`);
};

export const getProfileById = (id: string) => api.get<BackendProfile>(`/profiles/${id}`);

export const getVouchStatus = (id: string) =>
  api.get<{ hasVouched: boolean }>(`/profiles/${id}/vouch/status`);

export const vouchProfile = (profileId: string) =>
  api.post<{ profile: BackendProfile; vouch: unknown }>(`/profiles/${profileId}/vouch`);

export interface UpsertProfilePayload {
  // Con id, el backend actualiza ese perfil (incluido el oficio) en lugar de crear otro.
  id?: string;
  oficio_id: string;
  zone_id: string;
  description: string | null;
  years_experience: number | null;
  location_lat?: number | null;
  location_lng?: number | null;
}

export const upsertProfile = (payload: UpsertProfilePayload) =>
  api.post<BackendProfile>('/profiles', payload);

// ============================================================================
// FAVORES
// ============================================================================

export const listFavors = (params: { zoneId: string; type?: FavorType }) => {
  const query = new URLSearchParams();
  query.set('zone_id', params.zoneId);
  if (params.type) query.set('type', params.type);
  return api.get<BackendFavor[]>(`/favors?${query.toString()}`);
};

export const getFavorById = (id: string) => api.get<BackendFavor>(`/favors/${id}`);

export interface CreateFavorPayload {
  client_id: string;
  zone_id: string;
  type: FavorType;
  title: string;
  description?: string | null;
}

export const createFavor = (payload: CreateFavorPayload) =>
  api.post<BackendFavor>('/favors', payload);

export const expressInterest = (favorId: string, message?: string) =>
  api.post<unknown>(`/favors/${favorId}/interest`, { message: message ?? null });

// ============================================================================
// EMERGENCIA
// ============================================================================

export const getEmergencyState = (zoneId: string) =>
  api.get<BackendEmergencyState>(`/emergency?zone_id=${zoneId}`);

export const listServices = (zoneId: string) =>
  api.get<BackendService[]>(`/emergency/services?zone_id=${zoneId}`);

export const listReports = (zoneId: string) =>
  api.get<BackendReport[]>(`/emergency/reports?zone_id=${zoneId}`);

export interface CreateReportPayload {
  zone_id: string;
  lat?: number | null;
  lng?: number | null;
  description: string;
  needs: ResourceType[];
  is_anonymous: boolean;
}

export const createReport = (payload: CreateReportPayload) =>
  api.post<BackendReport>('/emergency/reports', payload);

export const listResources = (zoneId: string) =>
  api.get<BackendResource[]>(`/resources?zoneId=${zoneId}`);

// ============================================================================
// SINCRONIZACIÓN OFFLINE
// ============================================================================

export interface SyncOperation {
  client_id: string;
  operation: 'create_favor' | 'create_vulnerability_report';
  payload: Record<string, unknown>;
}

export interface SyncResult {
  client_id: string;
  operation: string;
  status: 'enviado' | 'error';
  ignored?: boolean;
  error?: string;
}

export const sendSyncBatch = (operations: SyncOperation[]) =>
  api.post<{ total: number; processed: number; results: SyncResult[] }>('/sync', operations);
