import { CASTILLA_OUTLINE } from './castillaOutline';

// Ray casting: cuenta cuántas aristas cruza un rayo horizontal desde el punto.
export function isWithinCastilla(coords: { lat: number; lng: number }): boolean {
  let inside = false;
  for (let i = 0, j = CASTILLA_OUTLINE.length - 1; i < CASTILLA_OUTLINE.length; j = i++) {
    const [xi, yi] = CASTILLA_OUTLINE[i]!;
    const [xj, yj] = CASTILLA_OUTLINE[j]!;
    const cruza =
      yi > coords.lat !== yj > coords.lat &&
      coords.lng < ((xj - xi) * (coords.lat - yi)) / (yj - yi) + xi;
    if (cruza) inside = !inside;
  }
  return inside;
}
