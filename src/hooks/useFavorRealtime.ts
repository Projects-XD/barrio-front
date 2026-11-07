import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/app-store';

// Contador para garantizar un nombre de canal único por montaje y evitar colisiones
// en supabase.channel() cuando varias pantallas o transiciones montan el hook a la vez.
let channelInstanceSeq = 0;

// Escucha los favores de la zona del vecino y refresca las listas al instante.
// Requiere Realtime activado en la tabla favors (ver SQL en el commit).
export function useFavorRealtime() {
  const qc = useQueryClient();
  const zoneId = useAppStore((s) => s.zoneId);

  useEffect(() => {
    if (!zoneId) return;
    channelInstanceSeq += 1;
    const channelName = `favors-zona-${zoneId}-${channelInstanceSeq}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'favors', filter: `zone_id=eq.${zoneId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ['favors'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [zoneId, qc]);
}
