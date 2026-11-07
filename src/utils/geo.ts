export type Coords = { lat: number; lng: number };

// Redondea a 3 decimales (~110 m). Úsalo en reportes de vulnerabilidad para no exponer la casa exacta.
export function roundForReport(c: Coords): Coords {
  return { lat: Number(c.lat.toFixed(3)), lng: Number(c.lng.toFixed(3)) };
}

// Centro aproximado de Castilla (Piura), para centrar el mapa antes de que el usuario elija un punto.
export const CASTILLA_CENTER: Coords = { lat: -5.19, lng: -80.63 };
