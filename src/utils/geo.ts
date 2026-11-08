import { CASTILLA_OUTLINE } from './castillaOutline';

export type Coords = { lat: number; lng: number };

// Redondea a 3 decimales (~110 m). Úsalo en reportes de vulnerabilidad para no exponer la casa exacta.
export function roundForReport(c: Coords): Coords {
  return { lat: Number(c.lat.toFixed(3)), lng: Number(c.lng.toFixed(3)) };
}

// Centro aproximado de Castilla (Piura), para centrar el mapa antes de que el usuario elija un punto.
export const CASTILLA_CENTER: Coords = { lat: -5.1116108, lng: -80.5354521 };

// Límites geográficos del distrito de Castilla (Piura) para delimitar el mapa y la detección.
export const CASTILLA_BOUNDS: [[number, number], [number, number]] = [
  [-5.26, -80.665], // Suroeste (límite sur con Catacaos / oeste con río Piura)
  [-4.95, -80.35],  // Noreste (límite norte con Tambogrande / este con Chulucanas)
];

// Comprueba si una coordenada está dentro del distrito de Castilla.
export function isWithinCastilla(coords: Coords): boolean {
  if (
    coords.lat < CASTILLA_BOUNDS[0][0] ||
    coords.lat > CASTILLA_BOUNDS[1][0] ||
    coords.lng < CASTILLA_BOUNDS[0][1] ||
    coords.lng > CASTILLA_BOUNDS[1][1]
  ) {
    return false;
  }
  return pointInPolygon(coords, CASTILLA_OUTLINE);
}

// Ray casting: cuenta cuántas aristas cruza un rayo horizontal desde el punto.
export function pointInPolygon(coords: Coords, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const cruza =
      yi > coords.lat !== yj > coords.lat &&
      coords.lng < ((xj - xi) * (coords.lat - yi)) / (yj - yi) + xi;
    if (cruza) inside = !inside;
  }
  return inside;
}

// Distancia en metros mediante fórmula de Haversine.
export function distanceMetersBetween(a: Coords, b: Coords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

// Formato minimalista hiperlocal: "A 240 m · 3 min a pie"
export function formatDistanceAndWalk(meters: number | null | undefined): string | null {
  if (meters == null || Number.isNaN(meters)) return null;
  const clamped = Math.max(40, Math.round(meters / 10) * 10);
  const walkMinutes = Math.max(1, Math.round(clamped / 75)); // ~4.5 km/h paso vecinal
  const distLabel =
    clamped < 1000 ? `A ${clamped} m` : `A ${(clamped / 1000).toFixed(1)} km`;
  if (walkMinutes <= 25) {
    return `${distLabel} · ${walkMinutes} min a pie`;
  }
  return distLabel;
}
