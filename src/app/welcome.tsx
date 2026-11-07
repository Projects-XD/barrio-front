import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, radius, shadow, spacing } from '@/theme';

const logoBarrio = require('../../assets/brand/logo-barrio.png');
const imgOficios = require('../../assets/Welcome/work_welcome_1.avif');
const imgFavores = require('../../assets/Welcome/work_welcome_2.png');
const imgEmergencia = require('../../assets/Welcome/work_welcome_3.jpg');

interface SlideItem {
  id: string;
  tag: string;
  image: any;
  title: string;
  subtitle: string;
  bgColor: string;      // Color exacto del fondo de la imagen
  accentColor: string;  // Color del tag y dot activo
}

const SLIDES: SlideItem[] = [
  {
    id: 'oficios',
    tag: 'Servicios de proximidad',
    image: imgOficios,
    title: 'Oficios de confianza en tu barrio',
    subtitle: 'Encuentra gasfiteros, electricistas y técnicos recomendados y avalados directamente por tus propios vecinos.',
    bgColor: '#FFFFFF', // Blanco puro igual al fondo de la imagen 1
    accentColor: colors.naranja,
  },
  {
    id: 'favores',
    tag: 'Economía solidaria',
    image: imgFavores,
    title: 'Apoyo mutuo sin dinero',
    subtitle: 'Préstamo de herramientas, ayuda temporal, donación de materiales y una red solidaria donde todos suman.',
    bgColor: colors.naranjaClaro, // Fondo cálido (la imagen 2 es PNG transparente, se adapta perfecto)
    accentColor: colors.naranja,
  },
  {
    id: 'emergencia',
    tag: 'Red comunitaria',
    image: imgEmergencia,
    title: 'Coordinación en emergencias',
    subtitle: 'Geolocalización de ayuda crítica, víveres y soporte ante contingencias, disponible tanto online como offline.',
    bgColor: '#8BCCC4', // Color exacto del fondo de la imagen 3
    accentColor: colors.azul,
  },
];

export default function Welcome() {
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const isLast = currentIndex === SLIDES.length - 1;
  const isLoggedIn = Boolean(useAppStore((s) => s.token && s.userId));

  // Ancho útil del contenedor principal (máximo 500px en PC para preservar relación de aspecto)
  const containerWidth = Math.min(width, 500);
  const slideWidth = containerWidth;
  const imageHeight = Math.min(Math.max(height * 0.38, 220), 320);

  // Animación del carrusel completo
  // Los valores animados y los refs no se leen durante el render: se crean una vez y se actualizan en efectos.
  const [animX] = useState(() => new Animated.Value(0));
  const currentIndexRef = useRef(currentIndex);
  const goRef = useRef<(index: number) => void>(() => {});

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const goToSlide = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= SLIDES.length) return;
    setCurrentIndex(newIndex);
    Animated.timing(animX, {
      toValue: -newIndex * slideWidth,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  useEffect(() => {
    animX.setValue(-currentIndexRef.current * slideWidth);
  }, [animX, slideWidth]);

  useEffect(() => {
    goRef.current = goToSlide;
  });

  // Gestor de deslizamiento con Mouse (PC) y Touch (Celular)
  // El gestor se crea en un efecto (no durante el render) y solo lee refs dentro de sus callbacks.
  const [panResponder, setPanResponder] = useState<ReturnType<typeof PanResponder.create> | null>(null);

  useEffect(() => {
    setPanResponder(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12,
        onPanResponderRelease: (_, gesture) => {
          const threshold = 45;
          if (gesture.dx < -threshold && currentIndexRef.current < SLIDES.length - 1) {
            goRef.current(currentIndexRef.current + 1);
          } else if (gesture.dx > threshold && currentIndexRef.current > 0) {
            goRef.current(currentIndexRef.current - 1);
          } else {
            goRef.current(currentIndexRef.current);
          }
        },
      })
    );
  }, []);

  const finishGuide = () => {
    if (isLoggedIn) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.navigate('/(tabs)/perfil');
      }
      return;
    }
    router.replace('/register');
  };

  const handleNext = () => {
    if (isLast) {
      finishGuide();
    } else {
      goToSlide(currentIndex + 1);
    }
  };

  const handleSkip = () => {
    finishGuide();
  };

  return (
    <View style={styles.outerScreen}>
      {/* Contenedor con ancho delimitado en PC y 100% en celular */}
      <View style={[styles.mainWrapper, { width: containerWidth }]}>
        {/* Cabecera */}
        <SafeAreaView edges={['top']} style={styles.topSafeArea}>
          <View style={styles.header}>
            <Image source={logoBarrio} style={styles.logo} resizeMode="contain" />
            <Pressable onPress={handleSkip} hitSlop={16} style={styles.skipBtn}>
              <Text style={styles.skipText}>{isLoggedIn ? 'Cerrar' : 'Saltar'}</Text>
            </Pressable>
          </View>
        </SafeAreaView>

        {/* Viewport del Carrusel */}
        <View style={styles.sliderViewport} {...(panResponder?.panHandlers ?? {})}>
          <Animated.View
            style={[
              styles.sliderTrack,
              {
                width: slideWidth * SLIDES.length,
                transform: [{ translateX: animX }],
              },
            ]}
          >
            {SLIDES.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.slide,
                  {
                    width: slideWidth,
                    backgroundColor: item.bgColor, // Cada slide llena su área completa de su color
                  },
                ]}
              >
                {/* Ilustración */}
                <View style={[styles.imageContainer, { height: imageHeight }]}>
                  <Image
                    source={item.image}
                    style={styles.image}
                    resizeMode="contain"
                  />
                </View>

                {/* Contenido Textual */}
                <View style={styles.textContainer}>
                  <Text style={[styles.tagText, { color: item.accentColor }]}>
                    {item.tag.toUpperCase()}
                  </Text>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.subtitle}>{item.subtitle}</Text>
                </View>
              </View>
            ))}
          </Animated.View>
        </View>

        {/* Footer flotante con fondo transparente */}
        <SafeAreaView edges={['bottom']} style={styles.bottomSafeArea}>
          <View style={styles.footer}>
            <View style={styles.paginationDots}>
              {SLIDES.map((item, i) => {
                const active = i === currentIndex;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => goToSlide(i)}
                    hitSlop={8}
                    style={[
                      styles.dot,
                      active
                        ? [styles.dotActive, { backgroundColor: item.accentColor }]
                        : styles.dotInactive,
                    ]}
                  />
                );
              })}
            </View>

            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}
            >
              <Text style={styles.ctaText}>
                {isLast ? (isLoggedIn ? 'Finalizar guía' : 'Empezar ahora') : 'Continuar'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerScreen: {
    flex: 1,
    backgroundColor: colors.fondo, // Fondo general de la app
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainWrapper: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  topSafeArea: {
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  logo: {
    width: 110,
    height: 36,
  },
  skipBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  skipText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.gris,
  },
  sliderViewport: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  sliderTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  slide: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  imageContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    marginTop: spacing.lg,
  },
  tagText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 23,
    lineHeight: 29,
    color: colors.azul,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.texto,
    textAlign: 'center',
    maxWidth: 320,
    opacity: 0.85,
  },
  bottomSafeArea: {
    zIndex: 10,
    marginTop: 'auto',
    backgroundColor: 'transparent',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 6,
    borderRadius: radius.pill,
  },
  dotActive: {
    width: 24,
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(94, 107, 130, 0.25)',
  },
  ctaButton: {
    backgroundColor: colors.naranja,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.blanco,
  },
});
