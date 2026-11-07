import { createElement, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Coords } from '@/utils/geo';
import { buildMapHtml } from './mapHtml';

export type MapPickerHandle = { setPoint: (c: Coords) => void };

type Props = {
  initial: Coords;
  height?: number;
  onChange: (c: Coords) => void;
};

type FrameWindow = Window & { setPoint?: (lat: number, lng: number) => void };

// En navegador de escritorio el mapa va dentro de un iframe (el WebView es solo para móvil).
export const MapPicker = forwardRef<MapPickerHandle, Props>(function MapPicker(
  { initial, height = 300, onChange },
  ref,
) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [srcDoc] = useState(() => buildMapHtml(initial));
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data) as { source?: string; lat: number; lng: number };
          if (parsed.source === 'barrio-map') onChangeRef.current({ lat: parsed.lat, lng: parsed.lng });
        } catch {
          // Mensajes ajenos al mapa se ignoran.
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useImperativeHandle(ref, () => ({
    setPoint: (c: Coords) => {
      const win = frameRef.current?.contentWindow as FrameWindow | null | undefined;
      win?.setPoint?.(c.lat, c.lng);
    },
  }));

  return (
    <View style={[styles.wrap, { height }]}>
      {createElement('iframe', {
        ref: (el: HTMLIFrameElement | null) => {
          frameRef.current = el;
        },
        srcDoc,
        title: 'Mapa de ubicación',
        style: { width: '100%', height: '100%', border: 0 },
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#DFE1E5' },
});
