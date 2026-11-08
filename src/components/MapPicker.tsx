import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ElementRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
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
  outline?: [number, number][];
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
  zones?: { id: string; name: string; lat: number; lng: number }[];
  onChange: (c: Coords, zoneId?: string) => void;
};

export const MapPicker = forwardRef<MapPickerHandle, Props>(function MapPicker(
  { initial, height = 300, maxBounds, outline, minZoom, maxZoom, initialZoom, zones, onChange },
  ref,
) {
  const webRef = useRef<ElementRef<typeof WebView>>(null);
  const [html] = useState(() =>
    buildMapHtml(initial, { maxBounds, outline, minZoom, maxZoom, zoom: initialZoom, zones }),
  );

  useEffect(() => {
    if (zones && zones.length > 0) {
      webRef.current?.injectJavaScript(`window.setZones(${JSON.stringify(zones)}); true;`);
    }
  }, [zones]);

  useImperativeHandle(ref, () => ({
    setPoint: (c: Coords) => {
      webRef.current?.injectJavaScript(`window.setPoint(${c.lat}, ${c.lng}); true;`);
    },
    setZones: (zList) => {
      webRef.current?.injectJavaScript(`window.setZones(${JSON.stringify(zList)}); true;`);
    },
  }));

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://barrio.app' }}
        onMessage={(event) => {
          const data = JSON.parse(event.nativeEvent.data) as {
            source?: string;
            lat: number;
            lng: number;
            zoneId?: string;
          };
          if (data.source === 'barrio-map') onChange({ lat: data.lat, lng: data.lng }, data.zoneId);
        }}
        javaScriptEnabled
        domStorageEnabled
        style={styles.web}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#DFE1E5' },
  web: { flex: 1 },
});
