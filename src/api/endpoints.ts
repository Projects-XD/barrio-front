import { request } from './client';
import type { CriticalResource, EmergencyState, Favor, FavorType, ProfessionalProfile, SupportService, VulnerabilityReport } from '@/types';

export const listProfiles = (token: string, params: { zoneId: string; oficio?: string }) =>
  request<ProfessionalProfile[]>(`/profiles?${new URLSearchParams(params as Record<string, string>)}`, {}, token);

export const vouchProfile = (token: string, profileId: string) =>
  request<ProfessionalProfile>(`/profiles/${profileId}/vouch`, { method: 'POST' }, token);

export const listFavors = (token: string, params: { zoneId: string; type?: FavorType }) =>
  request<Favor[]>(`/favors?${new URLSearchParams(params as Record<string, string>)}`, {}, token);

export const createFavor = (token: string, body: { type: FavorType; title: string; description?: string; clientId: string }) =>
  request<Favor>('/favors', { method: 'POST', body: JSON.stringify(body) }, token);

export const getEmergencyState = (token: string, zoneId: string) =>
  request<EmergencyState>(`/emergency?zoneId=${zoneId}`, {}, token);

export const listServices = (token: string, zoneId: string) =>
  request<SupportService[]>(`/services?zoneId=${zoneId}`, {}, token);

export const listReports = (token: string, zoneId: string) =>
  request<VulnerabilityReport[]>(`/reports?zoneId=${zoneId}`, {}, token);

export const listResources = (token: string, zoneId: string) =>
  request<CriticalResource[]>(`/resources?zoneId=${zoneId}`, {}, token);
