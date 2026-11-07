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

export type BarrioPoint = { id: string; lat: number; lng: number; kind: 'pedir' | 'ofrecer'; label: string };

// Mapa de barrio: muestra un punto por cada favor (azul = pido, naranja = ofrezco).
export function buildBarrioMapHtml(center: Coords) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html,body,#map{height:100%;margin:0;padding:0;font-family:system-ui,sans-serif}
    .leg{position:absolute;left:10px;bottom:10px;z-index:999;background:#fff;border-radius:12px;padding:8px 12px;font-size:13px;font-weight:600;color:#132E66;box-shadow:0 2px 8px rgba(0,0,0,.18)}
    .dot{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;vertical-align:middle}
    .vacio{position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:999;background:#fff;border-radius:999px;padding:6px 14px;font-size:13px;color:#5E6B82;box-shadow:0 2px 8px rgba(0,0,0,.15);display:none}
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="leg"><span class="dot" style="background:#132E66"></span>Pido ayuda &nbsp; <span class="dot" style="background:#EA982B"></span>Ofrezco ayuda</div>
  <div class="vacio" id="vacio">Aún no hay favores en el mapa</div>
  <script>
    var map = L.map('map').setView([${center.lat}, ${center.lng}], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    var layer = L.layerGroup().addTo(map);

    function send(msg) {
      var s = JSON.stringify(Object.assign({ source: 'barrio-map' }, msg));
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(s);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(s, '*');
      }
    }

    window.setPoints = function (points) {
      layer.clearLayers();
      document.getElementById('vacio').style.display = points.length ? 'none' : 'block';
      points.forEach(function (p) {
        var color = p.kind === 'ofrecer' ? '#EA982B' : '#132E66';
        var m = L.circleMarker([p.lat, p.lng], {
          radius: 11, color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 1
        }).addTo(layer);
        m.bindTooltip(p.label);
        m.on('click', function () { send({ type: 'point', id: p.id }); });
      });
    };

    window.setCenter = function (lat, lng) {
      map.setView([lat, lng], 15);
    };
  </script>
</body>
</html>`;
}
