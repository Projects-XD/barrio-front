import { useEffect, useRef, useState, type ElementRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Coords } from '@/utils/geo';
import { buildBarrioMapHtml, type BarrioPoint } from './mapHtml';

type Props = {
  center: Coords;
  points: BarrioPoint[];
  selectedId?: string | null;
  userLocation?: Coords | null;
  userFocusTrigger?: number;
  fitTrigger?: number;
  onPointPress?: (id: string) => void;
  onMapClear?: () => void;
  height?: number;
};

// Mapa de barrio para celular. Los puntos se actualizan sin recargar el mapa.
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
  const webRef = useRef<ElementRef<typeof WebView>>(null);
  const [html] = useState(() => buildBarrioMapHtml(center, points));
  const [ready, setReady] = useState(false);
  const payload = JSON.stringify(points);

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(`if (window.setPoints) window.setPoints(${payload}, false); true;`);
  }, [payload, ready]);

  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    if (!ready) return;
    if (!selectedId) {
      webRef.current?.injectJavaScript(`if (window.focusPoint) window.focusPoint(null); true;`);
      return;
    }
    const found = pointsRef.current.find((pt) => pt.id === selectedId);
    if (found) {
      webRef.current?.injectJavaScript(
        `if (window.focusPoint) window.focusPoint(${JSON.stringify(found.id)}, ${found.lat}, ${found.lng}); true;`,
      );
    }
  }, [selectedId, ready]);

  useEffect(() => {
    if (!ready) return;
    if (!userLocation) {
      webRef.current?.injectJavaScript(`if (window.setUserLocation) window.setUserLocation(null, null, false); true;`);
      return;
    }
    webRef.current?.injectJavaScript(
      `if (window.setUserLocation) window.setUserLocation(${userLocation.lat}, ${userLocation.lng}, ${userFocusTrigger > 0}); true;`,
    );
  }, [userLocation, userFocusTrigger, ready]);

  useEffect(() => {
    if (!ready || fitTrigger === 0) return;
    webRef.current?.injectJavaScript(`if (window.fitAllPoints) window.fitAllPoints(); true;`);
  }, [fitTrigger, ready]);

  useEffect(() => {
    if (!ready) return;
    webRef.current?.injectJavaScript(`if (window.setCenter) window.setCenter(${center.lat}, ${center.lng}); true;`);
  }, [center.lat, center.lng, ready]);

  return (
    <View style={[styles.wrap, height != null ? { height } : styles.fill]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://barrio.app' }}
        onLoadEnd={() => setReady(true)}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data) as { source?: string; type?: string; id?: string };
            if (data.source !== 'barrio-map') return;
            if (data.type === 'ready') setReady(true);
            else if (data.type === 'point' && data.id) onPointPress?.(data.id);
            else if (data.type === 'clear') onMapClear?.();
          } catch {
            // Mensajes ajenos se ignoran.
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#EAE3D8' },
  fill: { flex: 1 },
  web: { flex: 1 },
});

