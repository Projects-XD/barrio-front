import { useEffect, useRef, useState, type ElementRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Coords } from '@/utils/geo';
import { buildBarrioMapHtml, type BarrioPoint } from './mapHtml';

type Props = {
  center: Coords;
  points: BarrioPoint[];
  onPointPress?: (id: string) => void;
  height?: number;
};

// Mapa de barrio para celular. Los puntos se actualizan sin recargar el mapa.
export function BarrioMap({ center, points, onPointPress, height = 340 }: Props) {
  const webRef = useRef<ElementRef<typeof WebView>>(null);
  const [html] = useState(() => buildBarrioMapHtml(center));
  const [ready, setReady] = useState(false);
  const payload = JSON.stringify(points);

  useEffect(() => {
    if (ready) webRef.current?.injectJavaScript(`window.setPoints(${payload}); true;`);
  }, [payload, ready]);

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://barrio.app' }}
        onLoadEnd={() => setReady(true)}
        onMessage={(event) => {
          const data = JSON.parse(event.nativeEvent.data) as { source?: string; type?: string; id?: string };
          if (data.source === 'barrio-map' && data.type === 'point' && data.id) onPointPress?.(data.id);
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
  web: { flex: 1 },
});
