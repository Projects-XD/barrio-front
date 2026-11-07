import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
    id: 'oficios',
    image: oficiosImg,
    titulo: 'Oficios validados por vecinos',
    texto: 'Encuentra gasfiteros, carpinteros y técnicos recomendados con el visto bueno de vecinos de tu misma zona.',
  },
  {
    id: 'favores',
    image: favoresImg,
    titulo: 'Muro de favores sin dinero',
    texto: 'Préstamo de herramientas, apoyo temporal, donaciones e intercambio de habilidades solidarias.',
  },
  {
    id: 'emergencia',
    image: emergenciaImg,
    titulo: 'Red de apoyo en emergencia',
    texto: 'La app se adapta ante emergencias para coordinar agua, medicinas, generadores y reportes de vecinos.',
  },
];

export default function Welcome() {
  const p = usePalette();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  // Un solo valor animado: el carrusel entero se desplaza hacia la izquierda o la derecha.
  const [offset] = useState(() => new Animated.Value(0));

  const slideWidth = Math.min(Math.max(width - spacing.md * 2, 280), 520);
  const imageHeight = Math.min(height * 0.25, 220);
  const imageWidth = Math.min(slideWidth * 0.85, 300);
  const last = index === slides.length - 1;

  useEffect(() => {
    Animated.timing(offset, {
      toValue: -index * slideWidth,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, slideWidth, offset]);

  const next = () => {
    if (last) {
      router.replace('/register');
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <Screen scroll={false}>
      <View style={styles.carouselContainer}>
        <View style={{ width: slideWidth, overflow: 'hidden' }}>
          <Animated.View
            style={{
              flexDirection: 'row',
              width: slideWidth * slides.length,
              transform: [{ translateX: offset }],
            }}
          >
            {slides.map((item) => (
              <View key={item.id} style={[styles.slideItem, { width: slideWidth }]}>
                <View
                  style={[
                    styles.imageCard,
                    { width: imageWidth, height: imageHeight, borderColor: colors.grisBorde },
                  ]}
                >
                  <Image source={item.image} style={styles.image} resizeMode="cover" accessibilityLabel={item.titulo} />
                </View>
                <Text style={[styles.titulo, { color: p.text }]}>{item.titulo}</Text>
                <Text style={[styles.texto, { color: p.muted }]}>{item.texto}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        <View style={styles.dots}>
          {slides.map((_, i) => {
            const active = i === index;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`Ir a diapositiva ${i + 1}`}
                onPress={() => setIndex(i)}
                style={[styles.dot, { backgroundColor: active ? p.primary : p.border, width: active ? 22 : 8 }]}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.actions}>
        <AppButton label={last ? 'Empezar ahora' : 'Siguiente'} variant="accent" onPress={next} />
        <AppButton label="Saltar introducción" variant="link" onPress={() => router.replace('/register')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  carouselContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  slideItem: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm },
  imageCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    backgroundColor: colors.blanco,
    alignSelf: 'center',
  },
  image: { width: '100%', height: '100%' },
  titulo: { fontSize: 22, fontFamily: fonts.bold, textAlign: 'center', marginBottom: spacing.xs, lineHeight: 28 },
  texto: { fontSize: 15, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 22, paddingHorizontal: spacing.xs },
  dots: { flexDirection: 'row', gap: 8, marginVertical: spacing.md, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 8, borderRadius: radius.pill },
  actions: { paddingTop: spacing.xs },
});
