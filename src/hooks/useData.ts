import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Favor, FavorType, OficioCategory, ProfessionalProfile } from '@/types';
import { favorsMock, profilesMock, reportsMock, resourcesMock, servicesMock, ZONE_ID } from '@/data/mock';
import { enqueue } from '@/offline/outbox';
import { flushOutbox } from '@/offline/sync';
import { useAppStore } from '@/store/app-store';

const delay = <T,>(value: T, ms = 250) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

function newClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useProfiles(oficio?: string, search?: string) {
  return useQuery({
    queryKey: ['profiles', oficio ?? 'todos', search ?? ''],
    queryFn: () => {
      let result = profilesMock;
      if (oficio) {
        result = result.filter((p) => p.oficio.category === oficio);
      }
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        result = result.filter(
          (p) =>
            p.user.fullName.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.oficio.name.toLowerCase().includes(q)
        );
      }
      return delay(result);
    },
  });
}

export function useProfile(id: string) {
  return useQuery({
    queryKey: ['profile', id],
    queryFn: () => delay(profilesMock.find((p) => p.id === id) ?? null),
  });
}

export function useMyProfile() {
  return useQuery({
    queryKey: ['myProfile'],
    queryFn: () => delay(profilesMock.find((p) => p.userId === 'me') ?? null),
  });
}

export function useUpsertMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      category: OficioCategory;
      description: string;
      yearsExperience: number;
    }) => {
      const existingIdx = profilesMock.findIndex((p) => p.userId === 'me');
      const profileData: ProfessionalProfile = {
        id: existingIdx >= 0 ? profilesMock[existingIdx].id : `p-me-${Date.now()}`,
        userId: 'me',
        user: { id: 'me', fullName: 'Alexander García', avatarUrl: null },
        oficio: { id: `o-${input.category}`, category: input.category, name: input.category },
        zoneId: ZONE_ID,
        description: input.description,
        yearsExperience: input.yearsExperience,
        distanceKm: 0.1,
        validatedCount: existingIdx >= 0 ? profilesMock[existingIdx].validatedCount : 0,
        isValidated: existingIdx >= 0 ? profilesMock[existingIdx].isValidated : false,
        hasVouchedByMe: false,
      };

      if (existingIdx >= 0) {
        profilesMock[existingIdx] = profileData;
      } else {
        profilesMock.unshift(profileData);
      }

      return delay(profileData, 150);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] });
      qc.invalidateQueries({ queryKey: ['myProfile'] });
    },
  });
}

export function useVouch(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => delay(null, 150),
    onSuccess: () => {
      const profile = profilesMock.find((p) => p.id === id);
      if (profile && !profile.hasVouchedByMe) {
        profile.hasVouchedByMe = true;
        profile.validatedCount += 1;
        profile.isValidated = profile.validatedCount >= 2;
      }
      qc.invalidateQueries({ queryKey: ['profile', id] });
      qc.invalidateQueries({ queryKey: ['profiles'] });
      qc.invalidateQueries({ queryKey: ['myProfile'] });
    },
  });
}

export function useFavors(type?: FavorType) {
  return useQuery({
    queryKey: ['favors', type ?? 'todos'],
    queryFn: () => delay(favorsMock.filter((f) => !type || f.type === type)),
  });
}

export function useCreateFavor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { type: FavorType; title: string; description: string | null }) => {
      const clientId = newClientId();
      const online = useAppStore.getState().isOnline;

      await enqueue(clientId, 'create_favor', { ...input, clientId });
      if (online) await flushOutbox();

      const favor: Favor = {
        id: clientId,
        authorId: 'me',
        author: { id: 'me', fullName: 'Tú' },
        zoneId: ZONE_ID,
        type: input.type,
        title: input.title,
        description: input.description,
        status: 'abierta',
        interestedCount: 0,
        hasInterestedByMe: false,
        createdAt: new Date().toISOString(),
        syncStatus: online ? 'enviado' : 'pendiente',
      };
      return favor;
    },
    onSuccess: (favor) => {
      favorsMock.unshift(favor);
      qc.invalidateQueries({ queryKey: ['favors'] });
    },
  });
}

export function useServices() {
  return useQuery({ queryKey: ['services'], queryFn: () => delay(servicesMock) });
}

export function useReports() {
  return useQuery({ queryKey: ['reports'], queryFn: () => delay(reportsMock) });
}

export function useResources() {
  return useQuery({ queryKey: ['resources'], queryFn: () => delay(resourcesMock) });
}
