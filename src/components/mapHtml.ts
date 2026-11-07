import type { Coords } from '@/utils/geo';

// HTML de Leaflet compartido por el mapa nativo (WebView) y el mapa web (iframe).
// Cada click envía un mensaje: al WebView de React Native o al documento padre en web.
export function buildMapHtml(initial: Coords) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
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
      var msg = JSON.stringify({ source: 'barrio-map', lat: ll.lat, lng: ll.lng });
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(msg);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
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
