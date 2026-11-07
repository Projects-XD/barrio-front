import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts, radius, spacing } from '@/theme';

const slides = [
  {
    icono: '🛠️',
    titulo: 'Oficios validados por vecinos',
    texto: 'Encuentra gasfiteros, carpinteros y técnicos recomendados con el visto bueno de vecinos de tu misma zona.',
  },
  {
    icono: '🤝',
    titulo: 'Muro de favores sin dinero',
    texto: 'Préstamo de herramientas, apoyo temporal, donaciones e intercambio de habilidades solidarias.',
  },
  {
    icono: '🚨',
    titulo: 'Red de apoyo en emergencia',
    texto: 'La app se adapta ante emergencias para coordinar agua, medicinas, generadores y reportes de vecinos.',
  },
];

export default function Welcome() {
  const p = usePalette();
  const [index, setIndex] = useState(0);
  const last = index === slides.length - 1;
  const slide = slides[index];

  const next = () => (last ? router.replace('/register') : setIndex(index + 1));

  return (
    <Screen scroll={false}>
      <View style={styles.slide}>
        <View style={[styles.ilustra, { backgroundColor: '#E0ECFB', borderColor: colors.grisBorde }]}>
          <Text style={styles.iconoText}>{slide.icono}</Text>
        </View>

        <Text style={[styles.titulo, { color: p.text }]}>{slide.titulo}</Text>
        <Text style={[styles.texto, { color: p.muted }]}>{slide.texto}</Text>

        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? p.primary : p.border,
                  width: i === index ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <AppButton
        label={last ? 'Empezar ahora' : 'Siguiente'}
        variant="accent"
        onPress={next}
      />
      <AppButton
        label="Saltar introducción"
        variant="link"
        onPress={() => router.replace('/register')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  ilustra: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderWidth: 2,
  },
  iconoText: {
    fontSize: 56,
  },
  titulo: {
    fontSize: 26,
    fontFamily: fonts.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 34,
  },
  texto: {
    fontSize: 16,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: spacing.xl,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: radius.pill,
  },
});
