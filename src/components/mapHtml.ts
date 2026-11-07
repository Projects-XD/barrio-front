import type { Coords } from '@/utils/geo';
import type { FavorType, FavorUrgency } from '@/types';

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

export type BarrioPoint = {
  id: string;
  lat: number;
  lng: number;
  kind: 'pedir' | 'ofrecer';
  label: string;
  urgency?: FavorUrgency;
  type?: FavorType;
  authorName?: string;
};

// Mapa de barrio: muestra un punto por cada favor (azul = pido, naranja = ofrezco).
export function buildBarrioMapHtml(center: Coords, initialPoints: BarrioPoint[] = []) {
  const initialJson = JSON.stringify(initialPoints).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html,body,#map{height:100%;margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:#FBF7F1}
    .leaflet-control-zoom{border:none !important;box-shadow:0 3px 10px rgba(19,46,102,.18) !important;border-radius:12px !important;overflow:hidden}
    .leaflet-control-zoom a{color:#132E66 !important;font-weight:700 !important}
    .leg{position:absolute;left:10px;bottom:10px;z-index:999;background:rgba(255,255,255,.95);border-radius:12px;padding:7px 11px;font-size:12px;font-weight:600;color:#132E66;box-shadow:0 2px 8px rgba(19,46,102,.16);border:1px solid #EAE3D8}
    .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:middle}
    .vacio{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:999;background:rgba(255,255,255,.96);border-radius:999px;padding:8px 16px;font-size:13px;font-weight:600;color:#5E6B82;box-shadow:0 3px 12px rgba(19,46,102,.18);display:none;white-space:nowrap}
    .pin-wrap{display:flex;align-items:center;justify-content:center;position:relative}
    .pin-core{width:24px;height:24px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 7px rgba(19,46,102,.35);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;transition:transform .15s ease}
    .pin-selected .pin-core{transform:scale(1.32);border-color:#132E66;box-shadow:0 4px 12px rgba(19,46,102,.55)}
    .pin-urg{position:absolute;width:34px;height:34px;border-radius:50%;border:2px solid #B8442F;animation:pulse 1.8s infinite;pointer-events:none}
    @keyframes pulse{0%{transform:scale(.85);opacity:.9}70%{transform:scale(1.35);opacity:0}100%{transform:scale(1.35);opacity:0}}
    .leaflet-tooltip.barrio-tip{background:#132E66;color:#fff;border:none;border-radius:8px;padding:4px 8px;font-size:12px;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,.25)}
    .leaflet-tooltip-top.barrio-tip:before{border-top-color:#132E66}
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="leg"><span class="dot" style="background:#132E66"></span>Piden ayuda &nbsp; <span class="dot" style="background:#EA982B"></span>Ofrecen ayuda</div>
  <div class="vacio" id="vacio">No hay puntos con estos filtros</div>
  <script>
    var centerCoord = [${center.lat}, ${center.lng}];
    var map = L.map('map', { zoomControl: false }).setView(centerCoord, 15);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    var layer = L.layerGroup().addTo(map);
    var currentPoints = [];
    var selectedId = null;
    var hasAutoFitted = false;

    function send(msg) {
      var s = JSON.stringify(Object.assign({ source: 'barrio-map' }, msg));
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(s);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(s, '*');
      }
    }

    function renderMarkers() {
      layer.clearLayers();
      var vacioEl = document.getElementById('vacio');
      if (vacioEl) vacioEl.style.display = currentPoints.length ? 'none' : 'block';

      currentPoints.forEach(function (p) {
        var isOffer = p.kind === 'ofrecer';
        var bg = isOffer ? '#EA982B' : '#132E66';
        var fg = isOffer ? '#132E66' : '#ffffff';
        var isSelected = selectedId === p.id;
        var isUrgent = p.urgency === 'urgente' || p.urgency === 'emergencia';
        var symbol = isOffer ? '★' : '!';
        var html = '<div class="pin-wrap ' + (isSelected ? 'pin-selected' : '') + '">' +
          (isUrgent ? '<div class="pin-urg"></div>' : '') +
          '<div class="pin-core" style="background:' + bg + ';color:' + fg + '">' + symbol + '</div>' +
          '</div>';

        var icon = L.divIcon({
          className: '',
          html: html,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        var m = L.marker([p.lat, p.lng], {
          icon: icon,
          zIndexOffset: isSelected ? 1000 : (isOffer ? 200 : 100)
        }).addTo(layer);

        m.bindTooltip(p.label, { direction: 'top', offset: [0, -14], className: 'barrio-tip' });
        m.on('click', function (e) {
          L.DomEvent.stopPropagation(e);
          selectedId = p.id;
          renderMarkers();
          send({ type: 'point', id: p.id });
        });
      });
    }

    map.on('click', function () {
      if (selectedId !== null) {
        selectedId = null;
        renderMarkers();
        send({ type: 'clear' });
      }
    });

    window.fitAllPoints = function () {
      if (!currentPoints.length) {
        map.setView(centerCoord, 15);
        return;
      }
      if (currentPoints.length === 1) {
        map.setView([currentPoints[0].lat, currentPoints[0].lng], 16, { animate: true });
        return;
      }
      var bounds = L.latLngBounds(currentPoints.map(function (p) { return [p.lat, p.lng]; }));
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 16, animate: true });
    };

    window.setPoints = function (points, shouldFit) {
      currentPoints = Array.isArray(points) ? points : [];
      renderMarkers();
      if ((shouldFit || !hasAutoFitted) && currentPoints.length > 0) {
        hasAutoFitted = true;
        window.fitAllPoints();
      }
    };

    window.focusPoint = function (id, lat, lng) {
      selectedId = id || null;
      renderMarkers();
      if (typeof lat === 'number' && typeof lng === 'number') {
        map.setView([lat, lng], 16, { animate: true });
      }
    };

    window.setCenter = function (lat, lng) {
      centerCoord = [lat, lng];
      map.setView(centerCoord, 15, { animate: true });
    };

    var bootPoints = ${initialJson};
    if (bootPoints && bootPoints.length) {
      window.setPoints(bootPoints, true);
    }
    send({ type: 'ready' });
  </script>
</body>
</html>`;
}

