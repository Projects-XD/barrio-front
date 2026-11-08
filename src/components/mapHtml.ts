import type { Coords } from '@/utils/geo';
import { CASTILLA_OUTLINE } from '@/utils/castillaOutline';
import type { FavorType, FavorUrgency, OficioCategory } from '@/types';

export type MapHtmlOptions = {
  maxBounds?: [[number, number], [number, number]];
  outline?: [number, number][];
  minZoom?: number;
  maxZoom?: number;
  zoom?: number;
  zones?: { id: string; name: string; lat: number; lng: number }[];
};

// HTML de Leaflet compartido por el mapa nativo (WebView) y el mapa web (iframe).
// Cada click envía un mensaje: al WebView de React Native o al documento padre en web.
export function buildMapHtml(initial: Coords, options?: MapHtmlOptions) {
  const initialZoom = options?.zoom ?? 16;
  const minZoom = options?.minZoom ?? 10;
  const maxZoom = options?.maxZoom ?? 19;
  const boundsJson = options?.maxBounds ? JSON.stringify(options.maxBounds) : 'null';
  // Leaflet usa [lat, lng]; el contorno llega como [lng, lat].
  const outlineJson = options?.outline
    ? JSON.stringify(options.outline.map(([lng, lat]) => [lat, lng]))
    : 'null';
  const zonesJson =
    options?.zones && options.zones.length
      ? JSON.stringify(options.zones).replace(/</g, '\\u003c')
      : '[]';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html,body,#map{height:100%;margin:0;padding:0;background:#FBF7F1}
    .zone-label {
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid #132E66;
      border-radius: 6px;
      color: #132E66;
      font-size: 11px;
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 700;
      padding: 2px 6px;
      box-shadow: 0 1px 4px rgba(19, 46, 102, 0.18);
      white-space: nowrap;
      cursor: pointer;
    }
    .leaflet-tooltip-top.zone-label:before {
      border-top-color: #132E66;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var boundsData = ${boundsJson};
    var mapOptions = {
      minZoom: ${minZoom},
      maxZoom: ${maxZoom}
    };
    var bounds = null;
    if (boundsData) {
      bounds = L.latLngBounds(boundsData[0], boundsData[1]);
      mapOptions.maxBounds = bounds;
      mapOptions.maxBoundsViscosity = 1.0;
    }

    var map = L.map('map', mapOptions).setView([${initial.lat}, ${initial.lng}], ${initialZoom});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: ${maxZoom},
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var outlineData = ${outlineJson};
    if (outlineData) {
      L.polygon(outlineData, { color: '#D32F2F', weight: 3, fill: false, interactive: false }).addTo(map);
    } else if (bounds) {
      L.rectangle(bounds, { color: '#D32F2F', weight: 3, fill: false, interactive: false }).addTo(map);
    }

    var marker = L.circleMarker([${initial.lat}, ${initial.lng}], {
      radius: 9, color: '#132E66', fillColor: '#EA982B', fillOpacity: 1, weight: 3
    }).addTo(map);

    var zoneLayer = L.layerGroup().addTo(map);

    function renderZones(list) {
      zoneLayer.clearLayers();
      if (!list || !list.length) return;
      list.forEach(function (z) {
        if (typeof z.lat !== 'number' || typeof z.lng !== 'number') return;
        var zMarker = L.circleMarker([z.lat, z.lng], {
          radius: 6,
          color: '#132E66',
          fillColor: '#FFFFFF',
          fillOpacity: 1,
          weight: 2
        }).addTo(zoneLayer);

        zMarker.bindTooltip(z.name, {
          permanent: true,
          direction: 'top',
          className: 'zone-label',
          offset: [0, -6]
        });

        zMarker.on('click', function (e) {
          L.DomEvent.stopPropagation(e);
          send(L.latLng(z.lat, z.lng), z.id);
        });
      });
    }

    var initialZones = ${zonesJson};
    if (initialZones && initialZones.length) {
      renderZones(initialZones);
    }

    window.setZones = function (list) {
      renderZones(list);
    };

    var eventCallback = null;
    window.setEventCallback = function (fn) {
      eventCallback = fn;
    };

    function send(ll, zoneId) {
      marker.setLatLng(ll);
      var payload = { source: 'barrio-map', lat: ll.lat, lng: ll.lng };
      if (zoneId) payload.zoneId = zoneId;
      var msg = JSON.stringify(payload);
      if (typeof eventCallback === 'function') {
        try { eventCallback(msg); } catch (err) { console.warn('barrio-map: error en callback', err); }
      }
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(msg);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
    }

    map.on('click', function (e) {
      send(e.latlng);
    });

    window.setPoint = function (lat, lng) {
      var ll = L.latLng(lat, lng);
      marker.setLatLng(ll);
      map.setView(ll, Math.max(map.getZoom(), 13));
    };
  </script>
</body>
</html>`;
}

export type BarrioPoint = {
  id: string;
  lat: number;
  lng: number;
  kind: 'pedir' | 'ofrecer' | 'oficio' | 'emergencia';
  label: string;
  urgency?: FavorUrgency;
  type?: FavorType;
  oficioCategory?: OficioCategory;
  authorName?: string;
};

// Mapa de barrio: muestra un punto con icono SVG vectorial por cada publicación, oficio o reporte.
export function buildBarrioMapHtml(center: Coords, initialPoints: BarrioPoint[] = []) {
  const initialJson = JSON.stringify(initialPoints).replace(/</g, '\\u003c');
  const CASTILLA_OUTLINE_LEAFLET = JSON.stringify(CASTILLA_OUTLINE.map(([lng, lat]) => [lat, lng]));
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
    .leg{position:absolute;left:10px;bottom:10px;z-index:999;background:rgba(255,255,255,.95);border-radius:12px;padding:7px 11px;font-size:11px;font-weight:600;color:#132E66;box-shadow:0 2px 8px rgba(19,46,102,.16);border:1px solid #EAE3D8;display:flex;align-items:center;gap:10px;flex-wrap:wrap;max-width:78%}
    .leg-item{display:inline-flex;align-items:center;gap:5px}
    .dot{display:inline-block;width:9px;height:9px;border-radius:50%}
    .vacio{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:999;background:rgba(255,255,255,.96);border-radius:999px;padding:8px 16px;font-size:13px;font-weight:600;color:#5E6B82;box-shadow:0 3px 12px rgba(19,46,102,.18);display:none;white-space:nowrap}
    .pin-wrap{display:flex;align-items:center;justify-content:center;position:relative;width:38px;height:38px;cursor:pointer}
    .pin-core{width:28px;height:28px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(19,46,102,.32);display:flex;align-items:center;justify-content:center;transition:transform .18s ease,box-shadow .18s ease;pointer-events:none}
    .pin-core svg{pointer-events:none}
    .pin-wrap:hover .pin-core{transform:scale(1.14)}
    .pin-selected .pin-core{transform:scale(1.36) !important;border-color:#132E66;box-shadow:0 5px 14px rgba(19,46,102,.55)}
    .pin-ring-sel{position:absolute;width:38px;height:38px;border-radius:50%;border:2.5px solid #132E66;background:rgba(234,152,43,.22);pointer-events:none}
    .pin-urg{position:absolute;width:36px;height:36px;border-radius:50%;border:2px solid #B8442F;animation:pulse 1.8s infinite;pointer-events:none}
    .pin-wave{position:absolute;width:38px;height:38px;border-radius:50%;border:2px solid #D32F2F;background:rgba(211,47,47,.28);opacity:0;pointer-events:none;animation:wave 2.4s ease-out infinite}
    .pin-wave.w2{animation-delay:.8s}
    .pin-wave.w3{animation-delay:1.6s}
    .pin-wave.azul{border-color:#132E66;background:rgba(19,46,102,.25)}
    @keyframes wave{0%{transform:scale(.6);opacity:.8}100%{transform:scale(3.4);opacity:0}}
    @media (prefers-reduced-motion: reduce){.pin-wave{animation:none;opacity:.35;transform:scale(1.7)}.pin-wave.w2,.pin-wave.w3{display:none}}
    .user-wrap{display:flex;align-items:center;justify-content:center;position:relative;width:32px;height:32px}
    .user-pulse{position:absolute;width:30px;height:30px;border-radius:50%;background:rgba(43,74,140,.28);animation:pulse 2s infinite;pointer-events:none}
    .user-dot{width:14px;height:14px;border-radius:50%;background:#2B4A8C;border:3px solid #fff;box-shadow:0 2px 6px rgba(19,46,102,.4)}
    @keyframes pulse{0%{transform:scale(.82);opacity:.9}70%{transform:scale(1.38);opacity:0}100%{transform:scale(1.38);opacity:0}}
    .leaflet-tooltip.barrio-tip{background:#132E66;color:#fff;border:none;border-radius:8px;padding:5px 9px;font-size:12px;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,.25)}
    .leaflet-tooltip-top.barrio-tip:before{border-top-color:#132E66}
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="leg">
    <span class="leg-item"><span class="dot" style="background:#132E66"></span>Piden</span>
    <span class="leg-item"><span class="dot" style="background:#EA982B"></span>Ofrecen</span>
    <span class="leg-item"><span class="dot" style="background:#2E7D5B"></span>Oficios</span>
    <span class="leg-item"><span class="dot" style="background:#D32F2F"></span>Alertas</span>
  </div>
  <div class="vacio" id="vacio">No hay puntos con estos filtros</div>
  <script>
    var centerCoord = [${center.lat}, ${center.lng}];
    var map = L.map('map', { zoomControl: false }).setView(centerCoord, 15);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    L.polygon(${CASTILLA_OUTLINE_LEAFLET}, { color: '#D32F2F', weight: 3, fill: false, interactive: false }).addTo(map);
    var layer = L.layerGroup().addTo(map);
    var userLayer = L.layerGroup().addTo(map);
    var currentPoints = [];
    var markersById = {};
    var selectedId = null;
    var hasAutoFitted = false;

    var eventCb = null;
    window.setEventCallback = function (cb) {
      eventCb = cb;
    };

    function send(msg) {
      var payloadObj = Object.assign({ source: 'barrio-map' }, msg);
      var s = JSON.stringify(payloadObj);
      if (typeof eventCb === 'function') {
        try {
          eventCb(payloadObj);
        } catch (e) { console.warn('barrio-map: error en callback', e); }
      }
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(s);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(s, '*');
      }
    }

    function svgIconFor(p, strokeColor) {
      var common = 'width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + strokeColor + '" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"';
      if (p.kind === 'emergencia') {
        return '<svg ' + common + '><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      }
      if (p.kind === 'oficio') {
        return '<svg ' + common + '><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>';
      }
      var t = p.type || 'otros';
      if (t === 'herramienta') {
        return '<svg ' + common + '><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
      }
      if (t === 'ayuda_temporal') {
        return '<svg ' + common + '><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
      }
      if (t === 'donacion_materiales') {
        return '<svg ' + common + '><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
      }
      if (t === 'intercambio_habilidades') {
        return '<svg ' + common + '><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>';
      }
      if (t === 'movilidad_solidaria') {
        return '<svg ' + common + '><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
      }
      return '<svg ' + common + '><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    }

    function buildPinIcon(p, isSelected) {
      var bg = '#132E66';
      var fg = '#ffffff';
      if (p.kind === 'ofrecer') {
        bg = '#EA982B';
        fg = '#132E66';
      } else if (p.kind === 'oficio') {
        bg = '#2E7D5B';
        fg = '#ffffff';
      } else if (p.kind === 'emergencia') {
        bg = '#D32F2F';
        fg = '#ffffff';
      }

      // Ondas rojas: reportes de emergencia. Ondas azules: pedidos de nivel urgente o emergencia.
      // Los demás puntos urgentes (ofrecimientos) conservan el anillo simple.
      var isEmergency = p.kind === 'emergencia';
      var nivelAlto = p.urgency === 'urgente' || p.urgency === 'emergencia';
      var isPedidoUrgente = p.kind === 'pedir' && nivelAlto;
      var isUrgent = !isEmergency && !isPedidoUrgente && nivelAlto;
      var svg = svgIconFor(p, fg);
      var safeId = String(p.id).replace(/"/g, '');
      var html = '<div class="pin-wrap ' + (isSelected ? 'pin-selected' : '') + '" data-pin-id="' + safeId + '">' +
        (isSelected ? '<div class="pin-ring-sel"></div>' : '') +
        (isEmergency ? '<div class="pin-wave"></div><div class="pin-wave w2"></div><div class="pin-wave w3"></div>' : '') +
        (isPedidoUrgente ? '<div class="pin-wave azul"></div><div class="pin-wave azul w2"></div><div class="pin-wave azul w3"></div>' : '') +
        (isUrgent ? '<div class="pin-urg"></div>' : '') +
        '<div class="pin-core" style="background:' + bg + ';color:' + fg + '">' + svg + '</div>' +
        '</div>';

      return L.divIcon({
        className: '',
        html: html,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });
    }

    function updateSelectionVisuals() {
      currentPoints.forEach(function (p) {
        var m = markersById[p.id];
        if (!m) return;
        var isSel = selectedId === p.id;
        var el = m.getElement ? m.getElement() : null;
        if (el) {
          var wrap = el.querySelector('.pin-wrap');
          if (wrap) {
            if (isSel) wrap.classList.add('pin-selected');
            else wrap.classList.remove('pin-selected');
          }
          var ring = el.querySelector('.pin-ring-sel');
          if (isSel && !ring && wrap) {
            var r = document.createElement('div');
            r.className = 'pin-ring-sel';
            wrap.insertBefore(r, wrap.firstChild);
          } else if (!isSel && ring && ring.parentNode) {
            ring.parentNode.removeChild(ring);
          }
        }
        var zOffset = isSel ? 1000 : p.kind === 'emergencia' ? 400 : p.kind === 'ofrecer' ? 200 : 100;
        m.setZIndexOffset(zOffset);
      });
    }

    var lastClickId = null;
    var lastClickTs = 0;

    window.handlePinClick = function (id) {
      var now = Date.now();
      if (lastClickId === id && now - lastClickTs < 120) return;
      lastClickId = id;
      lastClickTs = now;

      var found = null;
      for (var i = 0; i < currentPoints.length; i++) {
        if (currentPoints[i].id === id) {
          found = currentPoints[i];
          break;
        }
      }
      if (!found) return;
      var isSame = selectedId === found.id;
      selectedId = found.id;
      updateSelectionVisuals();
      map.panTo([found.lat, found.lng], { animate: true });
      send({ type: 'point', id: found.id, same: isSame });
    };

    function findPinByLatLng(latlng) {
      if (!latlng || !currentPoints.length) return null;
      var clickPt = map.latLngToContainerPoint(latlng);
      var best = null;
      var bestDist = 26; // radio generoso de 26px alrededor del centro del marcador
      for (var i = 0; i < currentPoints.length; i++) {
        var p = currentPoints[i];
        var mPt = map.latLngToContainerPoint([p.lat, p.lng]);
        var dx = clickPt.x - mPt.x;
        var dy = clickPt.y - mPt.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= bestDist) {
          bestDist = dist;
          best = p;
        }
      }
      return best;
    }

    function renderMarkers() {
      layer.clearLayers();
      markersById = {};
      var vacioEl = document.getElementById('vacio');
      if (vacioEl) vacioEl.style.display = currentPoints.length ? 'none' : 'block';

      currentPoints.forEach(function (p) {
        var isSelected = selectedId === p.id;
        var icon = buildPinIcon(p, isSelected);
        var zOffset = isSelected ? 1000 : p.kind === 'emergencia' ? 400 : p.kind === 'ofrecer' ? 200 : 100;
        var m = L.marker([p.lat, p.lng], {
          icon: icon,
          zIndexOffset: zOffset
        }).addTo(layer);

        markersById[p.id] = m;
        m.bindTooltip(p.label, { direction: 'top', offset: [0, -15], className: 'barrio-tip', interactive: false });
        m.on('click', function () {
          window.handlePinClick(p.id);
        });
        m.on('mousedown', function () {
          window.handlePinClick(p.id);
        });
      });
    }

    // Respaldo 1: DOM pointerdown sobre cualquier marcador
    document.addEventListener('pointerdown', function (ev) {
      var tgt = ev.target;
      var wrap = tgt && tgt.closest ? tgt.closest('[data-pin-id]') : null;
      if (wrap) {
        var pid = wrap.getAttribute('data-pin-id');
        if (pid) {
          window.handlePinClick(pid);
        }
      }
    }, true);

    // Respaldo 2: Detección geométrica en píxeles sobre el mapa (infalible aunque algún overlay intercepte el icono)
    map.on('click', function (e) {
      var hit = findPinByLatLng(e.latlng);
      if (hit) {
        window.handlePinClick(hit.id);
        return;
      }
      var orig = e && e.originalEvent ? e.originalEvent : null;
      var tgt = orig && orig.target ? orig.target : null;
      if (tgt && tgt.closest && (tgt.closest('.leaflet-marker-icon') || tgt.closest('[data-pin-id]'))) {
        return;
      }
      if (Date.now() - lastClickTs < 400) return;
      if (selectedId !== null) {
        selectedId = null;
        updateSelectionVisuals();
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
      map.fitBounds(bounds, { padding: [46, 46], maxZoom: 16, animate: true });
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
      updateSelectionVisuals();
      if (typeof lat === 'number' && typeof lng === 'number') {
        map.panTo([lat, lng], { animate: true });
      }
    };

    window.setUserLocation = function (lat, lng, centerOnUser) {
      userLayer.clearLayers();
      if (typeof lat !== 'number' || typeof lng !== 'number') return;
      L.circle([lat, lng], {
        radius: 500,
        color: '#2B4A8C',
        weight: 1.5,
        dashArray: '5, 6',
        fillColor: '#2B4A8C',
        fillOpacity: 0.06,
        interactive: false
      }).addTo(userLayer);
      var uIcon = L.divIcon({
        className: '',
        html: '<div class="user-wrap"><div class="user-pulse"></div><div class="user-dot"></div></div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      var um = L.marker([lat, lng], { icon: uIcon, zIndexOffset: 900, interactive: false }).addTo(userLayer);
      um.bindTooltip('Tu ubicación · Radio vecinal 500 m', { direction: 'top', offset: [0, -12], className: 'barrio-tip' });
      if (centerOnUser) {
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
