import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listNotifications, type BackendNotification } from '@/api/endpoints';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/app-store';
import { logger } from '@/utils/logger';

// Número de canal único por montaje, para no chocar con otro canal del mismo nombre.
let channelSeq = 0;

// Respaldo de Realtime: si el canal no entrega el aviso, esta consulta lo detecta en poco tiempo.
const POLL_MS = 15_000;

// Un aviso cuenta como "nuevo" cuando cambia su firma: así un aviso de mensajes que se actualiza
// (llega otro mensaje en la misma conversación) vuelve a mostrarse, y el mismo estado no se repite.
const firma = (n: BackendNotification) => `${n.updated_at ?? n.created_at}|${String(n.payload?.count ?? '')}`;

// Entrega cada aviso nuevo o actualizado a `onNueva` (por ejemplo, para mostrar una ventana flotante),
// una sola vez. Tiene dos vías que comparten el registro de avisos ya entregados:
//   1. Realtime: instantáneo. Requiere la migración 0028 y permiso de lectura de `authenticated`.
//   2. Consulta cada 15 s: respaldo por si Realtime no llega.
// También actualiza al instante el contador y la lista de Avisos.
export function useNotificationsRealtime(onNueva?: (n: BackendNotification) => void) {
  const qc = useQueryClient();
  const userId = useAppStore((s) => s.userId);
  const isOnline = useAppStore((s) => s.isOnline);

  const callbackRef = useRef(onNueva);
  const vistos = useRef(new Map<string, string>());
  const sembrado = useRef(false);

  useEffect(() => {
    callbackRef.current = onNueva;
  });

  // Al cambiar de vecino se empieza de cero.
  useEffect(() => {
    vistos.current = new Map();
    sembrado.current = false;
  }, [userId]);

  const anunciar = useCallback(
    (n: BackendNotification) => {
      const f = firma(n);
      if (vistos.current.get(n.id) === f) return;
      vistos.current.set(n.id, f);
      // Un aviso ya leído solo se registra: no se muestra.
      if (n.read_at) return;
      // Una emergencia o alerta nueva (o su cierre) recarga el mapa y el estado de la zona al instante.
      if (n.type === 'emergencia_activada' || n.payload?.kind === 'emergencia_finalizada') {
        void qc.invalidateQueries({ queryKey: ['reports'] });
        void qc.invalidateQueries({ queryKey: ['emergency'] });
      }
      callbackRef.current?.(n);
    },
    [qc]
  );

  // Vía 1: Realtime (avisos nuevos y avisos que se actualizan).
  useEffect(() => {
    if (!userId) return;
    channelSeq += 1;
    const channel = supabase
      .channel(`avisos-${userId}-${channelSeq}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          void qc.invalidateQueries({ queryKey: ['notifications'] });
          if (payload.eventType === 'DELETE') return;
          const nueva = payload.new as BackendNotification;
          logger.info('AVISOS', 'Aviso recibido por Realtime', { type: nueva.type, evento: payload.eventType });
          anunciar(nueva);
        }
      )
      .subscribe((status) => {
        logger.info('AVISOS', 'Estado del canal de avisos', { status });
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc, anunciar]);

  // Vía 2: consulta periódica. La primera respuesta solo registra lo que ya existía, para no
  // mostrar de golpe los avisos viejos; después se entrega cada aviso sin leer que haya cambiado.
  useQuery({
    queryKey: ['notifications', userId, 'poll'],
    enabled: Boolean(userId) && isOnline,
    refetchInterval: POLL_MS,
    staleTime: 0,
    queryFn: async () => {
      const lista = await listNotifications();
      if (!sembrado.current) {
        lista.forEach((n) => vistos.current.set(n.id, firma(n)));
        sembrado.current = true;
      } else {
        // De la más antigua a la más nueva, para que salgan en orden.
        [...lista].reverse().forEach(anunciar);
      }
      return lista;
    },
  });
}
