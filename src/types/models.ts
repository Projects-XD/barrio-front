import type * as E from './enums';

export interface Zone {
  id: string;
  name: string;
  city: string;
  centerLat: number;
  centerLng: number;
}

export interface User {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  zoneId: string;
  status: E.UserStatus;
  emergencyRole: boolean;
  isAnonymousByDefault: boolean;
}

export interface Oficio {
  id: string;
  category: E.OficioCategory;
  name: string;
}

export interface ProfessionalProfile {
  id: string;
  userId: string;
  user: Pick<User, 'id' | 'fullName' | 'avatarUrl'>;
  oficio: Oficio;
  zoneId: string;
  description: string;
  yearsExperience: number | null;
  distanceKm?: number;
  validatedCount: number;
  isValidated: boolean;
  hasVouchedByMe: boolean;
  location?: { lat: number; lng: number } | null;
}

export interface Favor {
  id: string;
  authorId: string;
  author: Pick<User, 'id' | 'fullName'>;
  zoneId: string;
  type: E.FavorType;
  title: string;
  description: string | null;
  status: E.FavorStatus;
  distanceKm?: number;
  interestedCount: number;
  hasInterestedByMe: boolean;
  createdAt: string;
  syncStatus: E.SyncStatus;
  location?: { lat: number; lng: number } | null;
  urgency: E.FavorUrgency;
  moderationStatus: E.ModerationStatus;
  moderationReason: string | null;
  // Solo GET /favors/:id los calcula; en los listados quedan en false.
  canEdit: boolean;
  isDeactivated: boolean;
  assignedToUserId?: string | null;
}

export interface SupportService {
  id: string;
  name: string;
  type: E.ServiceType;
  phone: string;
  addressSummary: string;
  distanceKm?: number;
  hours: string | null;
  isVerified: boolean;
}

export interface VulnerabilityReport {
  id: string;
  zoneId: string;
  approxLat: number;
  approxLng: number;
  description: string;
  needs: E.ResourceType[];
  status: E.ReportStatus;
  isAnonymous: boolean;
  reporterName: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CriticalResource {
  id: string;
  kind: E.ResourceKind;
  resource: E.ResourceType;
  quantity: number | null;
  notes: string | null;
  status: 'abierto' | 'cubierto' | 'cancelado';
  distanceKm?: number;
}
