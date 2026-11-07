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
}

export interface FavorInterestItem {
  id: string;
  userId: string;
  userName: string;
  message: string | null;
  createdAt: string;
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
  interests?: FavorInterestItem[];
  createdAt: string;
  syncStatus: E.SyncStatus;
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
  userName?: string | null;
  distanceKm?: number;
}

export interface EmergencyState {
  zoneId: string;
  status: E.EmergencyStatus;
  reason: string | null;
  activatedAt: string | null;
}

export interface AppNotification {
  id: string;
  type: E.NotificationType;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}
