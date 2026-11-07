// Paleta "Barrio cálido": azul marino y naranja del logo sobre neutros cálidos.
// Azul marino = marca y títulos. Naranja = la única acción principal. Verde = validado. Rojo = solo emergencia.
export const colors = {
  azul: '#132E66',
  azulMedio: '#2B4A8C',
  azulSuave: '#EAF0FA',
  naranja: '#EA982B',
  naranjaSuave: '#FDEFD9',
  naranjaClaro: '#FFF7EC',
  verdeExito: '#2E7D5B',
  verdeExitoSuave: '#E5F3EC',
  rojo: '#B8442F',
  rojoSuave: '#FBEAE6',
  blanco: '#FFFFFF',
  fondo: '#FBF7F1',
  texto: '#2A3550',
  gris: '#5E6B82',
  grisBorde: '#EAE3D8',

  // Claves existentes que usan otras pantallas; apuntan a la paleta nueva.
  carbon: '#132E66',
  crema: '#FFF7EC',
  verde: '#132E66',
  ambar: '#EA982B',
  bordeSuave: '#EAE3D8',
  verdeSuave: '#FDEFD9',
  ambarSuave: '#FDEFD9',
};

export const fonts = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semiBold: 'InstrumentSans_600SemiBold',
  semibold: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 10, md: 16, lg: 20, xl: 28, pill: 999 };
export const touch = { min: 48 };

// Sombra suave teñida de azul: da profundidad sin verse pesada.
export const shadow = {
  shadowColor: '#132E66',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export function getPalette(emergency: boolean) {
  return {
    primary: emergency ? colors.rojo : colors.azul,
    accent: colors.naranja,
    // Botón de acción: naranja con texto azul marino (5.6:1). En emergencia, rojo con texto blanco (5.4:1).
    cta: emergency ? colors.rojo : colors.naranja,
    ctaText: emergency ? colors.blanco : colors.azul,
    background: colors.fondo,
    surface: colors.blanco,
    text: colors.azul,
    body: colors.texto,
    muted: colors.gris,
    border: colors.grisBorde,
    highlight: emergency ? colors.rojoSuave : colors.naranjaSuave,
    info: colors.azulSuave,
    badge: colors.azulSuave,
    success: colors.verdeExito,
    successSoft: colors.verdeExitoSuave,
    emergency: colors.rojo,
  };
}

export type Palette = ReturnType<typeof getPalette>;
