import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/app-store';

// Escucha los favores de la zona del vecino y refresca las listas al instante.
// Requiere Realtime activado en la tabla favors (ver SQL en el commit).
export function useFavorRealtime() {
  const qc = useQueryClient();
  const zoneId = useAppStore((s) => s.zoneId);

  useEffect(() => {
    if (!zoneId) return;
    const channel = supabase
      .channel(`favors-zona-${zoneId}`)
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
