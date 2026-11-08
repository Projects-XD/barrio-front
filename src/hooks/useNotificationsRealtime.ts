import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BackendNotification } from '@/api/endpoints';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/app-store';
import { logger } from '@/utils/logger';

// Número de canal único por montaje, para no chocar con otro canal del mismo nombre.
let channelSeq = 0;

// Escucha los avisos nuevos del vecino por Realtime: actualiza al instante el contador y la lista,
// y entrega cada aviso nuevo a `onNueva` (por ejemplo, para mostrar un aviso emergente).
// Requiere la migración 0028 (política de lectura y tabla en la publicación de Realtime).
export function useNotificationsRealtime(onNueva?: (n: BackendNotification) => void) {
  const qc = useQueryClient();
  const userId = useAppStore((s) => s.userId);

  const callbackRef = useRef(onNueva);
  useEffect(() => {
    callbackRef.current = onNueva;
  });

  useEffect(() => {
    if (!userId) return;
    channelSeq += 1;
    const channel = supabase
      .channel(`avisos-${userId}-${channelSeq}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          logger.info('AVISOS', 'Aviso recibido por Realtime', { type: (payload.new as BackendNotification).type });
          void qc.invalidateQueries({ queryKey: ['notifications'] });
          callbackRef.current?.(payload.new as BackendNotification);
        }
      )
      .subscribe((status) => {
        logger.info('AVISOS', 'Estado del canal de avisos', { status });
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
