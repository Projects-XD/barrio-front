import { createElement, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Coords } from '@/utils/geo';
import { buildBarrioMapHtml, type BarrioPoint } from './mapHtml';

type Props = {
  center: Coords;
  points: BarrioPoint[];
  selectedId?: string | null;
  userLocation?: Coords | null;
  userFocusTrigger?: number;
  fitTrigger?: number;
  onPointPress?: (id: string, same?: boolean) => void;
  onMapClear?: () => void;
  height?: number;
};

type FrameWindow = Window & {
  setPoints?: (points: BarrioPoint[], shouldFit?: boolean) => void;
  focusPoint?: (id: string | null, lat?: number, lng?: number) => void;
  setUserLocation?: (lat: number | null, lng: number | null, centerOnUser?: boolean) => void;
  fitAllPoints?: () => void;
  setCenter?: (lat: number, lng: number) => void;
  setEventCallback?: (cb: ((msg: { type?: string; id?: string; same?: boolean }) => void) | null) => void;
};

// En navegador de escritorio el mapa va en un iframe. Los puntos se actualizan sin recargar.
export function BarrioMap({
  center,
  points,
  selectedId = null,
  userLocation = null,
  userFocusTrigger = 0,
  fitTrigger = 0,
  onPointPress,
  onMapClear,
  height,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [srcDoc] = useState(() => buildBarrioMapHtml(center, points));
  const [ready, setReady] = useState(false);
  const pressRef = useRef(onPointPress);
  const clearRef = useRef(onMapClear);
  useEffect(() => {
    pressRef.current = onPointPress;
    clearRef.current = onMapClear;
  });
  const payload = JSON.stringify(points);

  // Enlace directo con el iframe (más rápido y fiable que postMessage) + respaldo por postMessage
  useEffect(() => {
    let lastEventId = '';
    let lastEventTs = 0;
    const handleMsg = (data: { source?: string; type?: string; id?: string; same?: boolean }) => {
      const now = Date.now();
      const key = `${data.type ?? ''}:${data.id ?? ''}`;
      if (key === lastEventId && now - lastEventTs < 80) return;
      lastEventId = key;
      lastEventTs = now;

      if (data.type === 'ready') setReady(true);
      else if (data.type === 'point' && data.id) pressRef.current?.(data.id, data.same);
      else if (data.type === 'clear') clearRef.current?.();
    };

    const win = frameRef.current?.contentWindow as FrameWindow | null | undefined;
    win?.setEventCallback?.(handleMsg);

    const handler = (event: MessageEvent) => {
      try {
        const data = (typeof event.data === 'string' ? JSON.parse(event.data) : event.data) as {
          source?: string;
          type?: string;
          id?: string;
          same?: boolean;
        };
        if (!data || data.source !== 'barrio-map') return;
        handleMsg(data);
      } catch {
        // Mensajes ajenos se ignoran.
      }
    };
    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
      win?.setEventCallback?.(null);
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const win = frameRef.current?.contentWindow as FrameWindow | null | undefined;
    win?.setPoints?.(JSON.parse(payload) as BarrioPoint[], false);
  }, [payload, ready]);

  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    if (!ready) return;
    const win = frameRef.current?.contentWindow as FrameWindow | null | undefined;
    if (!selectedId) {
      win?.focusPoint?.(null);
      return;
    }
    const found = pointsRef.current.find((pt) => pt.id === selectedId);
    if (found) win?.focusPoint?.(found.id, found.lat, found.lng);
  }, [selectedId, ready]);

  useEffect(() => {
    if (!ready) return;
    const win = frameRef.current?.contentWindow as FrameWindow | null | undefined;
    if (!userLocation) {
      win?.setUserLocation?.(null, null, false);
      return;
    }
    win?.setUserLocation?.(userLocation.lat, userLocation.lng, userFocusTrigger > 0);
  }, [userLocation, userFocusTrigger, ready]);

  useEffect(() => {
    if (!ready || fitTrigger === 0) return;
    const win = frameRef.current?.contentWindow as FrameWindow | null | undefined;
    win?.fitAllPoints?.();
  }, [fitTrigger, ready]);

  useEffect(() => {
    if (!ready) return;
    const win = frameRef.current?.contentWindow as FrameWindow | null | undefined;
    win?.setCenter?.(center.lat, center.lng);
  }, [center.lat, center.lng, ready]);

  return (
    <View style={[styles.wrap, height != null ? { height } : styles.fill]}>
      {createElement('iframe', {
        ref: frameRef,
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
  fill: { flex: 1 },
});

