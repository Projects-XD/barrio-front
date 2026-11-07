import { api } from './client';
import type {
  CriticalResource,
  EmergencyState,
  FavorType,
  OficioCategory,
  SupportService,
  VulnerabilityReport,
} from '@/types';

// ============================================================================
// TIPOS DE RESPUESTA DIRECTA DEL BACKEND (con claves snake_case de Postgres)
// ============================================================================

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
  };
  oficio: {
    id: string;
    category: OficioCategory;
    name: string;
    is_active?: boolean;
  };
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
  };
}

// ============================================================================
// ENDPOINTS OFICIOS (Módulo Día a Día)
// ============================================================================

export interface ListProfilesParams {
  zoneId: string;
  oficioId?: string;
  category?: OficioCategory;
}

export const listProfiles = (params: ListProfilesParams) => {
  const query = new URLSearchParams();
  query.set('zone_id', params.zoneId);
  if (params.oficioId) query.set('oficio_id', params.oficioId);
  if (params.category) query.set('category', params.category);

  return api.get<BackendProfile[]>(`/profiles?${query.toString()}`);
};

export const getProfileById = (id: string) =>
  api.get<BackendProfile>(`/profiles/${id}`);

export const vouchProfile = (profileId: string) =>
  api.post<{ profile: BackendProfile; vouch: unknown }>(`/profiles/${profileId}/vouch`);

export const removeVouch = (profileId: string) =>
  api.delete<{ profile: BackendProfile }>(`/profiles/${profileId}/vouch`);

// ============================================================================
// ENDPOINTS FAVORES (Módulo Día a Día)
// ============================================================================

export interface ListFavorsParams {
  zoneId: string;
  type?: FavorType;
}

export const listFavors = (params: ListFavorsParams) => {
  const query = new URLSearchParams();
  query.set('zone_id', params.zoneId);
  if (params.type) query.set('type', params.type);

  return api.get<BackendFavor[]>(`/favors?${query.toString()}`);
};

export const getFavorById = (id: string) =>
  api.get<BackendFavor>(`/favors/${id}`);

export interface CreateFavorPayload {
  client_id: string;
  zone_id?: string | null;
  type: FavorType;
  title: string;
  description?: string | null;
}

export const createFavor = (payload: CreateFavorPayload) =>
  api.post<BackendFavor>('/favors', payload);

// ============================================================================
// OTROS ENDPOINTS (Mantenidos para compatibilidad con vistas secundarias)
// ============================================================================

export const getEmergencyState = (zoneId: string) =>
  api.get<EmergencyState>(`/emergency?zoneId=${zoneId}`);

export const listServices = (zoneId: string) =>
  api.get<SupportService[]>(`/services?zoneId=${zoneId}`);

export const listReports = (zoneId: string) =>
  api.get<VulnerabilityReport[]>(`/reports?zoneId=${zoneId}`);

export const listResources = (zoneId: string) =>
  api.get<CriticalResource[]>(`/resources?zoneId=${zoneId}`);
