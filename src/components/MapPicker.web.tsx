import { createElement, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Coords } from '@/utils/geo';
import { buildMapHtml } from './mapHtml';

export type MapPickerHandle = {
  setPoint: (c: Coords) => void;
  setZones?: (zones: { id: string; name: string; lat: number; lng: number }[]) => void;
};

type Props = {
  initial: Coords;
  height?: number;
  maxBounds?: [[number, number], [number, number]];
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
  zones?: { id: string; name: string; lat: number; lng: number }[];
  onChange: (c: Coords, zoneId?: string) => void;
};

type FrameWindow = Window & {
  setPoint?: (lat: number, lng: number) => void;
  setZones?: (zones: { id: string; name: string; lat: number; lng: number }[]) => void;
  setEventCallback?: (fn: (raw: string) => void) => void;
};

// En navegador de escritorio el mapa va dentro de un iframe (el WebView es solo para móvil).
export const MapPicker = forwardRef<MapPickerHandle, Props>(function MapPicker(
  { initial, height = 300, maxBounds, minZoom, maxZoom, initialZoom, zones, onChange },
  ref,
) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [srcDoc] = useState(() =>
    buildMapHtml(initial, { maxBounds, minZoom, maxZoom, zoom: initialZoom, zones }),
  );
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const zonesRef = useRef(zones);
  useEffect(() => {
    zonesRef.current = zones;
    const win = frameRef.current?.contentWindow as FrameWindow | null | undefined;
    if (zones && zones.length > 0) {
      win?.setZones?.(zones);
    }
  }, [zones]);

  const handleRawMessage = useCallback((raw: unknown) => {
    const parsed = (() => {
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw) as { source?: string; lat?: number; lng?: number; zoneId?: string };
        } catch {
          return null;
        }
      }
      if (raw && typeof raw === 'object') {
        return raw as { source?: string; lat?: number; lng?: number; zoneId?: string };
      }
      return null;
    })();
    if (parsed && parsed.source === 'barrio-map' && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
      onChangeRef.current({ lat: parsed.lat, lng: parsed.lng }, parsed.zoneId);
    }
  }, []);

  const initialRef = useRef(initial);
  useEffect(() => {
    initialRef.current = initial;
  }, [initial]);

  const bindCallback = useCallback(() => {
    const win = frameRef.current?.contentWindow as FrameWindow | null | undefined;
    win?.setEventCallback?.(handleRawMessage);
    win?.setPoint?.(initialRef.current.lat, initialRef.current.lng);
    if (zonesRef.current && zonesRef.current.length > 0) {
      win?.setZones?.(zonesRef.current);
    }
  }, [handleRawMessage]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      handleRawMessage(event.data);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleRawMessage]);

  useImperativeHandle(ref, () => ({
    setPoint: (c: Coords) => {
      const win = frameRef.current?.contentWindow as FrameWindow | null | undefined;
      win?.setPoint?.(c.lat, c.lng);
    },
    setZones: (zList) => {
      const win = frameRef.current?.contentWindow as FrameWindow | null | undefined;
      win?.setZones?.(zList);
    },
  }));

  return (
    <View style={[styles.wrap, { height }]}>
      {createElement('iframe', {
        ref: frameRef,
        srcDoc,
        onLoad: bindCallback,
        title: 'Mapa de ubicación',
        style: { width: '100%', height: '100%', border: 0 },
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#DFE1E5' },
});
