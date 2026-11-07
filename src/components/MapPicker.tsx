import { forwardRef, useImperativeHandle, useRef, useState, type ElementRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Coords } from '@/utils/geo';
import { buildMapHtml } from './mapHtml';

export type MapPickerHandle = { setPoint: (c: Coords) => void };

type Props = {
  initial: Coords;
  height?: number;
  onChange: (c: Coords) => void;
};

export const MapPicker = forwardRef<MapPickerHandle, Props>(function MapPicker(
  { initial, height = 300, onChange },
  ref,
) {
  const webRef = useRef<ElementRef<typeof WebView>>(null);
  const [html] = useState(() => buildMapHtml(initial));

  useImperativeHandle(ref, () => ({
    setPoint: (c: Coords) => {
      webRef.current?.injectJavaScript(`window.setPoint(${c.lat}, ${c.lng}); true;`);
    },
  }));

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://barrio.app' }}
        onMessage={(event) => {
          const data = JSON.parse(event.nativeEvent.data) as { source?: string; lat: number; lng: number };
          if (data.source === 'barrio-map') onChange({ lat: data.lat, lng: data.lng });
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
