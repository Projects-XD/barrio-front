export type Coords = { lat: number; lng: number };

// Redondea a 3 decimales (~110 m). Úsalo en reportes de vulnerabilidad para no exponer la casa exacta.
export function roundForReport(c: Coords): Coords {
  return { lat: Number(c.lat.toFixed(3)), lng: Number(c.lng.toFixed(3)) };
}

// Centro aproximado de Castilla (Piura), para centrar el mapa antes de que el usuario elija un punto.
export const CASTILLA_CENTER: Coords = { lat: -5.19, lng: -80.63 };

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
