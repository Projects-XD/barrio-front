import { forwardRef, useImperativeHandle, useRef, useState, type ElementRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Coords } from '@/utils/geo';

export type MapPickerHandle = { setPoint: (c: Coords) => void };

type Props = {
  initial: Coords;
  height?: number;
  onChange: (c: Coords) => void;
};

function buildHtml(initial: Coords) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>html,body,#map{height:100%;margin:0;padding:0}</style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${initial.lat}, ${initial.lng}], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    var marker = L.circleMarker([${initial.lat}, ${initial.lng}], {
      radius: 10, color: '#132E66', fillColor: '#EA982B', fillOpacity: 1, weight: 3
    }).addTo(map);
    function send(ll) {
      marker.setLatLng(ll);
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: ll.lat, lng: ll.lng }));
    }
    map.on('click', function (e) { send(e.latlng); });
    window.setPoint = function (lat, lng) {
      var ll = L.latLng(lat, lng);
      marker.setLatLng(ll);
      map.setView(ll, 17);
    };
  </script>
</body>
</html>`;
}

export const MapPicker = forwardRef<MapPickerHandle, Props>(function MapPicker(
  { initial, height = 300, onChange },
  ref,
) {
  const webRef = useRef<ElementRef<typeof WebView>>(null);
  const [html] = useState(() => buildHtml(initial));

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
          const data = JSON.parse(event.nativeEvent.data) as Coords;
          onChange(data);
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
