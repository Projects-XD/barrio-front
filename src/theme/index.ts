export const colors = {
  azul: '#132E66',
  naranja: '#EA982B',
  blanco: '#FFFFFF',
  carbon: '#2B2B2B',
  gris: '#6B6B6B',
  rojo: '#B8442F',
  crema: '#DFE1E5',
  bordeSuave: '#DFE1E5',
  verdeSuave: '#DFEEE6',
  ambarSuave: '#FBEED3',
};

export const fonts = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { md: 12, pill: 999 };
export const typography = { base: 18, pequeno: 16, subtitulo: 22, titulo: 28 };
export const touch = { min: 48 };

export function getPalette(emergency: boolean) {
  return {
    primary: emergency ? colors.rojo : colors.azul,
    cta: emergency ? colors.rojo : colors.naranja,
    ctaText: emergency ? colors.blanco : colors.carbon,
    background: colors.blanco,
    surface: colors.crema,
    text: colors.carbon,
    muted: colors.gris,
    border: colors.bordeSuave,
  };
}

export type Palette = ReturnType<typeof getPalette>;
