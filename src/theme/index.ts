export const colors = {
  crema: '#FAF7F2',
  carbon: '#2B2B2B',
  verde: '#2E6B4F',
  ambar: '#E0A030',
  rojo: '#B8442F',
  blanco: '#FFFFFF',
  gris: '#6B6B6B',
  bordeSuave: '#CFC8BB',
  verdeSuave: '#DFEEE6',
  ambarSuave: '#FBEED3',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { md: 12, pill: 999 };
export const typography = { base: 18, pequeno: 16, subtitulo: 22, titulo: 28 };
export const touch = { min: 48 };

export function getPalette(emergency: boolean) {
  return {
    primary: emergency ? colors.rojo : colors.verde,
    background: colors.crema,
    surface: colors.blanco,
    text: colors.carbon,
    muted: colors.gris,
    border: colors.bordeSuave,
  };
}

export type Palette = ReturnType<typeof getPalette>;
