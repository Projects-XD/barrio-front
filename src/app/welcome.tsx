import { useRef, useState } from 'react';
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
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
  const flatListRef = useRef<FlatList>(null);

  // Ancho exacto de cada diapositiva respetando los márgenes de Screen (16px a cada lado)
  const slideWidth = Math.max(width - spacing.md * 2, 280);
  const isSmallDevice = height < 700;
  const imageHeight = Math.min(height * 0.22, isSmallDevice ? 140 : 175);
  const imageWidth = Math.min(slideWidth * 0.85, 270);

  const last = index === slides.length - 1;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / slideWidth);
    if (newIndex >= 0 && newIndex < slides.length && newIndex !== index) {
      setIndex(newIndex);
    }
  };

  const goToSlide = (i: number) => {
    flatListRef.current?.scrollToIndex({ index: i, animated: true });
    setIndex(i);
  };

  const next = () => {
    if (last) {
      router.replace('/register');
    } else {
      const nextIndex = index + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setIndex(nextIndex);
    }
  };

  return (
    <Screen scroll={false}>
      <View style={styles.carouselContainer}>
        <FlatList
          ref={flatListRef}
          data={slides}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          bounces={false}
          getItemLayout={(_, i) => ({
            length: slideWidth,
            offset: slideWidth * i,
            index: i,
          })}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
            }, 50);
          }}
          renderItem={({ item }) => (
            <View style={[styles.slideItem, { width: slideWidth }]}>
              <View
                style={[
                  styles.imageCard,
                  {
                    width: imageWidth,
                    height: imageHeight,
                    borderColor: colors.grisBorde,
                  },
                ]}
              >
                <Image
                  source={item.image}
                  style={styles.image}
                  resizeMode="cover"
                  accessibilityLabel={item.titulo}
                />
              </View>

              <Text style={[styles.titulo, { color: p.text }]}>{item.titulo}</Text>
              <Text style={[styles.texto, { color: p.muted }]}>{item.texto}</Text>
            </View>
          )}
        />

        {/* Indicador de puntos interactivo con transiciones animadas */}
        <View style={styles.dots}>
          {slides.map((_, i) => {
            const active = i === index;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`Ir a diapositiva ${i + 1}`}
                onPress={() => goToSlide(i)}
                style={[
                  styles.dot,
                  {
                    backgroundColor: active ? p.primary : p.border,
                    width: active ? 22 : 8,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.actions}>
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideItem: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  imageCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    backgroundColor: colors.blanco,
    shadowColor: '#132E66',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    alignSelf: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  titulo: {
    fontSize: 22,
    fontFamily: fonts.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
    lineHeight: 28,
  },
  texto: {
    fontSize: 15,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.xs,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    height: 8,
    borderRadius: radius.pill,
  },
  actions: {
    paddingTop: spacing.xs,
  },
});
