import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createReport,
  getEmergencyState,
  listReports,
  listResources,
  listServices,
  resolveReport,
} from '@/api/endpoints';
import { enqueue } from '@/offline/outbox';
import { flushOutbox } from '@/offline/sync';
import { useAppStore } from '@/store/app-store';
import type { ResourceType, VulnerabilityReport } from '@/types';
import { generateUUID } from '@/utils/uuid';
import { FRESH_LIVE_MS, FRESH_SLOW_MS, KEEP_LONG_MS, isNetworkError } from './shared';
import { mapService, mapReport, mapResource } from './mappers';

// =====================================================================// EMERGENCIA
// =====================================================================
export function useEmergencyState() {
  const zoneId = useAppStore((s) => s.zoneId);
  const token = useAppStore((s) => s.token);
  return useQuery({
    queryKey: ['emergency', zoneId],
    enabled: Boolean(zoneId && token),
    queryFn: () => getEmergencyState(zoneId!),
    refetchInterval: 30_000,
    staleTime: FRESH_LIVE_MS,
  });
}

export function useServices() {
  const zoneId = useAppStore((s) => s.zoneId);
  return useQuery({
    queryKey: ['services', zoneId],
    staleTime: FRESH_SLOW_MS,
    gcTime: KEEP_LONG_MS,
    enabled: Boolean(zoneId),
    queryFn: async () => (await listServices(zoneId!)).map(mapService),
  });
}

/** Un reporte con expires_at ya pasado no se muestra aunque el servidor aún no lo archive. */
export const isReportExpired = (r: VulnerabilityReport, now = Date.now()) =>
  r.expiresAt != null && new Date(r.expiresAt).getTime() <= now;

// Mapa: basta con los 100 más recientes de la zona.
export function useReports() {
  const zoneId = useAppStore((s) => s.zoneId);
  return useQuery({
    queryKey: ['reports', zoneId],
    enabled: Boolean(zoneId),
    queryFn: async () =>
      (await listReports(zoneId!, 100)).items.map(mapReport).filter((r) => !isReportExpired(r)),
  });
}

const REPORTS_PAGE = 10;

// Pantalla de emergencia: scroll infinito de 10 en 10.
export function useInfiniteReports() {
  const zoneId = useAppStore((s) => s.zoneId);
  return useInfiniteQuery({
    queryKey: ['reports', zoneId, 'infinite'],
    enabled: Boolean(zoneId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listReports(zoneId!, REPORTS_PAGE, pageParam),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      return last.items.length && loaded < last.total ? loaded : undefined;
    },
    select: (data) => {
      const last = data.pages[data.pages.length - 1];
      return {
        items: data.pages.flatMap((p) => p.items.map(mapReport)).filter((r) => !isReportExpired(r)),
        total: last?.total ?? 0,
        canResolve: Boolean(last?.can_resolve),
      };
    },
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resolveReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });
}

export function useResources() {
  const zoneId = useAppStore((s) => s.zoneId);
  return useQuery({
    queryKey: ['resources', zoneId],
    enabled: Boolean(zoneId),
    queryFn: async () => (await listResources(zoneId!)).map(mapResource),
  });
}

export function useCreateReport() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      description: string;
      needs: ResourceType[];
      isAnonymous: boolean;
      location?: { lat: number; lng: number } | null;
    }) => {
      const { zoneId, isOnline } = useAppStore.getState();
      if (!zoneId) throw new Error('Tu cuenta no tiene zona asignada.');

      const payload = {
        zone_id: zoneId,
        lat: input.location?.lat ?? null,
        lng: input.location?.lng ?? null,
        description: input.description,
        needs: input.needs,
        is_anonymous: input.isAnonymous,
      };

      if (isOnline) {
        try {
          await createReport(payload);
          return { queued: false };
        } catch (error) {
          if (!isNetworkError(error)) throw error;
        }
      }

      await enqueue(generateUUID(), 'create_vulnerability_report', payload);
      return { queued: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['outboxPending'] });
      void flushOutbox();
    },
  });
}
