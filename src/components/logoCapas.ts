// Generado a partir de assets/brand/logo-barrio.png (1400 x 420): cada parte del logo como imagen recortada y su posición.
// Se usa en la pantalla de carga (src/app/index.tsx) para animar el logo por partes.
export const LOGO_ANCHO = 1400;
export const LOGO_ALTO = 420;

export type CapaLogo = { x: number; y: number; w: number; h: number; source: number };

export const CAPAS_LOGO = {
  casa: { x: 9, y: 8, w: 484, h: 308, source: require('../../assets/brand/logo-capas/casa.png') },
  ventanas: { x: 207, y: 108, w: 91, h: 82, source: require('../../assets/brand/logo-capas/ventanas.png') },
  per_izq: { x: 60, y: 195, w: 148, h: 169, source: require('../../assets/brand/logo-capas/per_izq.png') },
  per_cen: { x: 194, y: 220, w: 116, h: 105, source: require('../../assets/brand/logo-capas/per_cen.png') },
  per_der: { x: 295, y: 195, w: 148, h: 169, source: require('../../assets/brand/logo-capas/per_der.png') },
  arco: { x: 30, y: 325, w: 437, h: 83, source: require('../../assets/brand/logo-capas/arco.png') },
  B: { x: 515, y: 116, w: 191, h: 223, source: require('../../assets/brand/logo-capas/B.png') },
  a: { x: 710, y: 167, w: 168, h: 176, source: require('../../assets/brand/logo-capas/a.png') },
  r1: { x: 894, y: 169, w: 112, h: 173, source: require('../../assets/brand/logo-capas/r1.png') },
  r2: { x: 1013, y: 170, w: 112, h: 169, source: require('../../assets/brand/logo-capas/r2.png') },
  i: { x: 1128, y: 106, w: 70, h: 233, source: require('../../assets/brand/logo-capas/i.png') },
  o: { x: 1198, y: 167, w: 186, h: 176, source: require('../../assets/brand/logo-capas/o.png') },
  punto: { x: 1131, y: 108, w: 66, h: 58, source: require('../../assets/brand/logo-capas/punto.png') },
} satisfies Record<string, CapaLogo>;
