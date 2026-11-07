import { useEffect, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAppStore } from '@/store/app-store';
import { colors, spacing } from '@/theme';

const logoBarrio = require('../../assets/brand/logo-barrio.png');

export default function Index() {
  const hydrated = useAppStore((s) => s.hydrated);
  const userId = useAppStore((s) => s.userId);

  // Animaciones para la pantalla de carga (Splash Screen)
  // useState (no useRef) para que los valores animados se creen una sola vez sin leer refs durante el render.
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.9));
  const [pulseAnim] = useState(() => new Animated.Value(0.4));
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    // Animación de entrada suave del logo
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulso sutil en la barra indicadora
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    // Tiempo mínimo de visualización elegante para que la transición sea perceptible
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 1200);

    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [fadeAnim, scaleAnim, pulseAnim]);

  // Esperar tanto la hidratación del storage/sesión como el tiempo mínimo estético de presentación
  if (!hydrated || !minTimeElapsed) {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.brandBox,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image
            source={logoBarrio}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Barrio"
          />
        </Animated.View>

        {/* Indicador de carga estilizado tipo píldora pulsante */}
        <View style={styles.loaderContainer}>
          <Animated.View
            style={[
              styles.pulseIndicator,
              {
                opacity: pulseAnim,
              },
            ]}
          />
        </View>
      </View>
    );
  }

  return <Redirect href={userId ? '/(tabs)/inicio' : '/welcome'} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.fondo,
    paddingHorizontal: spacing.lg,
  },
  brandBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 70,
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseIndicator: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.naranja,
  },
});
