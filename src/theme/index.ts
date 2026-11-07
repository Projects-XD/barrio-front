export const colors = {
  // Paleta oficial 60-30-10:
  azul: '#132E66',       // 60% Primario (marca, navegación, títulos)
  naranja: '#EA982B',    // 10% Acción / Acento (CTA principal, botones de acción)
  grisBorde: '#DFE1E5',  // 30% Neutral / Secundario (bordes, separadores)
  rojo: '#B8442F',       // Solo en modo emergencia
  blanco: '#FFFFFF',     // Superficie limpia (tarjetas, modales)
  fondo: '#F8F9FA',      // Fondo de pantallas
  carbon: '#132E66',     // Texto de títulos / fuerte
  texto: '#1E293B',      // Texto de párrafos y lectura
  gris: '#64748B',       // Texto atenuado / secundario

  // Compatibilidad con ambos módulos:
  crema: '#DFE1E5',
  verde: '#132E66',
  ambar: '#EA982B',
  bordeSuave: '#DFE1E5',
  verdeSuave: '#E0ECFB',
  ambarSuave: '#FEF3C7',
};

export const fonts = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semiBold: 'InstrumentSans_600SemiBold',
  semibold: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const typography = { base: 18, pequeno: 15, subtitulo: 20, titulo: 28 };
export const touch = { min: 48 };

export function getPalette(emergency: boolean) {
  return {
    primary: emergency ? colors.rojo : colors.azul,
    accent: colors.naranja,
    cta: emergency ? colors.rojo : colors.naranja,
    // Blanco sobre naranja da 2.3:1; azul marino sobre naranja da 5.6:1 (WCAG AA).
    ctaText: emergency ? colors.blanco : colors.azul,
    background: colors.fondo,
    surface: colors.blanco,
    text: emergency ? colors.rojo : colors.carbon,
    body: colors.texto,
    muted: colors.gris,
    border: colors.grisBorde,
    badge: colors.verdeSuave,
    emergency: colors.rojo,
  };
}

export type Palette = ReturnType<typeof getPalette>;
