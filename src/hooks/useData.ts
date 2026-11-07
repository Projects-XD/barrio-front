import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Favor, FavorType } from '@/types';
import { favorsMock, profilesMock, reportsMock, resourcesMock, servicesMock, ZONE_ID } from '@/data/mock';

const delay = <T,>(value: T, ms = 300) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

export function useProfiles(oficio?: string) {
  return useQuery({
    queryKey: ['profiles', oficio ?? 'todos'],
    queryFn: () =>
      delay(profilesMock.filter((p) => !oficio || p.oficio.category === oficio)),
  });
}

export function useProfile(id: string) {
  return useQuery({
    queryKey: ['profile', id],
    queryFn: () => delay(profilesMock.find((p) => p.id === id) ?? null),
  });
}

export function useVouch(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => delay(null, 200),
    onSuccess: () => {
      const profile = profilesMock.find((p) => p.id === id);
      if (profile && !profile.hasVouchedByMe) {
        profile.hasVouchedByMe = true;
        profile.validatedCount += 1;
        profile.isValidated = profile.validatedCount >= 2;
      }
      qc.invalidateQueries({ queryKey: ['profile', id] });
      qc.invalidateQueries({ queryKey: ['profiles'] });
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
    mutationFn: (input: { type: FavorType; title: string; description: string | null }) =>
      delay<Favor>({
        id: `local-${Date.now()}`,
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
        syncStatus: 'pendiente',
      }),
    onSuccess: (favor) => {
      favorsMock.unshift({ ...favor, syncStatus: 'enviado' });
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
