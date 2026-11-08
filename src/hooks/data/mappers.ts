import { type BackendFavor, type BackendProfile, type BackendReport, type BackendResource, type BackendService } from '@/api/endpoints';
import { type OutboxItem } from '@/offline/outbox';
import type { CriticalResource, Favor, FavorType, FavorIntent, FavorUrgency, ProfessionalProfile, ResourceType, SupportService, VulnerabilityReport } from '@/types';
import { RESOURCE_TYPES } from './shared';

// =====================================================================// MAPEOS BACKEND -> UI
// =====================================================================
export function mapBackendProfileToFrontend(bp: BackendProfile, hasVouchedByMe = false): ProfessionalProfile {
  return {
    id: bp.id,
    userId: bp.user_id,
    user: {
      id: bp.user?.id ?? bp.user_id,
      fullName: bp.user?.full_name ?? 'Vecino',
      avatarUrl: bp.user?.avatar_url ?? null,
    },
    oficio: {
      id: bp.oficio?.id ?? bp.oficio_id,
      category: bp.oficio?.category ?? 'otro',
      name: bp.oficio?.name ?? 'Oficio',
    },
    zoneId: bp.zone_id ?? '',
    description: bp.description ?? '',
    yearsExperience: bp.years_experience ?? null,
    distanceKm: undefined,
    validatedCount: bp.validated_count ?? 0,
    isValidated: bp.is_validated ?? (bp.validated_count ?? 0) >= 2,
    hasVouchedByMe,
    location:
      bp.location_lat != null && bp.location_lng != null
        ? { lat: bp.location_lat, lng: bp.location_lng }
        : null,
  };
}

export function mapBackendFavorToFrontend(bf: BackendFavor, currentUserId?: string | null): Favor {
  const interests = bf.interests ?? [];
  return {
    id: bf.id,
    authorId: bf.author_id,
    author: {
      id: bf.author?.id ?? bf.author_id,
      fullName: bf.author?.full_name ?? 'Vecino',
    },
    zoneId: bf.zone_id ?? '',
    type: bf.type,
    title: bf.title,
    description: bf.description,
    status: bf.status,
    interestedCount: bf.interested_count ?? interests.length,
    hasInterestedByMe: Boolean(currentUserId) && interests.some((i) => i.user_id === currentUserId),
    createdAt: bf.created_at,
    location: bf.location_lat != null && bf.location_lng != null ? { lat: bf.location_lat, lng: bf.location_lng } : null,
    syncStatus: 'enviado',
    urgency: bf.urgency,
    intent: bf.intent ?? 'pedir',
    moderationStatus: bf.moderation_status,
    moderationReason: bf.moderation_reason ?? null,
    canEdit: bf.can_edit ?? false,
    isDeactivated: bf.is_deactivated ?? false,
    assignedToUserId: bf.assigned_to_user_id ?? null,
  };
}

export function mapPendingFavor(item: OutboxItem, userId: string | null, userName: string | null): Favor {
  const p = item.payload;
  return {
    id: item.clientId,
    authorId: userId ?? 'me',
    author: { id: userId ?? 'me', fullName: userName ?? 'Tú' },
    zoneId: String(p.zone_id ?? ''),
    type: p.type as FavorType,
    title: String(p.title ?? ''),
    description: (p.description as string | null) ?? null,
    status: 'abierta',
    interestedCount: 0,
    hasInterestedByMe: false,
    createdAt: item.createdAt,
    location: typeof p.location_lat === 'number' && typeof p.location_lng === 'number' ? { lat: p.location_lat, lng: p.location_lng } : null,
    syncStatus: item.attempts > 0 ? 'error' : 'pendiente',
    // Las operaciones encoladas antes de existir este campo no lo traen.
    urgency: (p.urgency as FavorUrgency | undefined) ?? 'normal',
    intent: (p.intent as FavorIntent | undefined) ?? 'pedir',
    moderationStatus: 'aprobado',
    moderationReason: null,
    canEdit: false,
    isDeactivated: false,
  };
}

export function mapService(s: BackendService): SupportService {
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    phone: s.phone ?? '',
    addressSummary: s.address_summary ?? '',
    hours: s.hours,
    isVerified: s.is_verified,
  };
}

export function mapReport(r: BackendReport): VulnerabilityReport {
  return {
    id: r.id,
    zoneId: r.zone_id ?? '',
    approxLat: r.approx_lat ?? 0,
    approxLng: r.approx_lng ?? 0,
    description: r.description,
    needs: (r.needs ?? []).filter((n): n is ResourceType => RESOURCE_TYPES.includes(n as ResourceType)),
    status: r.status,
    isAnonymous: r.is_anonymous,
    reporterName: r.is_anonymous ? null : (r.reporter?.full_name ?? null),
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    expiresAt: r.expires_at ?? null,
    affectedName: r.affected_name ?? null,
    locationDetail: r.location_detail ?? null,
    detailHidden: Boolean(r.detail_hidden),
    isMine: Boolean(r.is_mine),
    responders: (r.responders ?? []).map((x) => ({ id: x.user_id, name: x.user?.full_name ?? 'Un vecino' })),
    helpRequestedAt: r.help_requested_at ?? null,
    escalatedAt: r.escalated_at ?? null,
  };
}

export function mapResource(r: BackendResource): CriticalResource {
  return {
    id: r.id,
    kind: r.kind,
    resource: r.resource,
    quantity: r.quantity,
    notes: r.notes,
    status: r.status,
  };
}
