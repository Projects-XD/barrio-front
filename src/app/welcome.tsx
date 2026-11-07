import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts, radius, spacing } from '@/theme';

const oficiosImg = require('../../assets/welcome-oficios.jpg');
const favoresImg = require('../../assets/welcome-favores.jpg');
const emergenciaImg = require('../../assets/welcome-emergencia.jpg');

const slides = [
  {
    image: oficiosImg,
    titulo: 'Oficios validados por vecinos',
    texto: 'Encuentra gasfiteros, carpinteros y técnicos recomendados con el visto bueno de vecinos de tu misma zona.',
  },
  {
    image: favoresImg,
    titulo: 'Muro de favores sin dinero',
    texto: 'Préstamo de herramientas, apoyo temporal, donaciones e intercambio de habilidades solidarias.',
  },
  {
    image: emergenciaImg,
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
        <View style={[styles.imageWrapper, { borderColor: colors.grisBorde }]}>
          <Image
            source={slide.image}
            style={styles.image}
            resizeMode="cover"
            accessibilityLabel={slide.titulo}
          />
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
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  imageWrapper: {
    width: '100%',
    height: 250,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    borderWidth: 1,
    shadowColor: '#132E66',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    backgroundColor: colors.blanco,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  titulo: {
    fontSize: 24,
    fontFamily: fonts.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
    lineHeight: 32,
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
    marginVertical: spacing.lg,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: radius.pill,
  },
});
