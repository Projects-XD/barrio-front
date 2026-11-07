import { createElement, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Coords } from '@/utils/geo';
import { buildBarrioMapHtml, type BarrioPoint } from './mapHtml';

type Props = {
  center: Coords;
  points: BarrioPoint[];
  onPointPress?: (id: string) => void;
  height?: number;
};

type FrameWindow = Window & { setPoints?: (points: BarrioPoint[]) => void };

// En navegador de escritorio el mapa va en un iframe. Los puntos se actualizan sin recargar.
export function BarrioMap({ center, points, onPointPress, height = 340 }: Props) {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [srcDoc] = useState(() => buildBarrioMapHtml(center));
  const [ready, setReady] = useState(false);
  const pressRef = useRef(onPointPress);
  useEffect(() => {
    pressRef.current = onPointPress;
  });
  const payload = JSON.stringify(points);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      try {
        const data = JSON.parse(event.data) as { source?: string; type?: string; id?: string };
        if (data.source === 'barrio-map' && data.type === 'point' && data.id) pressRef.current?.(data.id);
      } catch {
        // Mensajes ajenos se ignoran.
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const win = frame?.contentWindow as FrameWindow | null | undefined;
    win?.setPoints?.(JSON.parse(payload) as BarrioPoint[]);
  }, [payload, ready, frame]);

  return (
    <View style={[styles.wrap, { height }]}>
      {createElement('iframe', {
        ref: setFrame,
        srcDoc,
        title: 'Mapa del barrio',
        onLoad: () => setReady(true),
        style: { width: '100%', height: '100%', border: 0 },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#EAE3D8' },
});
