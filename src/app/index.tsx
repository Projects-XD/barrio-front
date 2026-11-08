import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { CAPAS_LOGO, LOGO_ALTO, LOGO_ANCHO } from '@/components/logoCapas';
import { useAppStore } from '@/store/app-store';
import { colors, spacing } from '@/theme';

// Logo a 260 de ancho; cada capa se coloca con la misma escala que el logo original.
const ANCHO = 260;
const K = ANCHO / LOGO_ANCHO;
const ALTO = LOGO_ALTO * K;

// Duración de la animación y tiempo mínimo en pantalla (ms).
const DURACION_ANIMADA = 2300;
const MINIMO_ANIMADO = 2600;
const MINIMO_REDUCIDO = 900;

type Nombre = keyof typeof CAPAS_LOGO;
const LETRAS: Nombre[] = ['B', 'a', 'r1', 'r2', 'i', 'o'];
const PERSONAS: Nombre[] = ['per_izq', 'per_cen', 'per_der'];

// Una capa del logo: misma posición y proporción que en el logo completo.
function Capa({ nombre, style }: { nombre: Nombre; style?: object }) {
  const c = CAPAS_LOGO[nombre];
  return (
    <Animated.Image
      source={c.source}
      resizeMode="contain"
      accessible={false}
      style={[{ position: 'absolute', left: c.x * K, top: c.y * K, width: c.w * K, height: c.h * K }, style]}
    />
  );
}

// Arma un tramo de la animación: espera `retraso` y lleva el valor de 0 a 1.
function tramo(valor: Animated.Value, retraso: number, duracion: number, easing: (t: number) => number, nativo = true) {
  return Animated.sequence([
    Animated.delay(retraso),
    Animated.timing(valor, { toValue: 1, duration: duracion, easing, useNativeDriver: nativo }),
  ]);
}

export default function Index() {
  const hydrated = useAppStore((s) => s.hydrated);
  const userId = useAppStore((s) => s.userId);

  // useState (no useRef) para que los valores animados se creen una sola vez sin leer refs durante el render.
  const [casa] = useState(() => new Animated.Value(0));
  const [ventanas] = useState(() => new Animated.Value(0));
  const [personas] = useState(() => PERSONAS.map(() => new Animated.Value(0)));
  const [arco] = useState(() => new Animated.Value(0));
  const [letras] = useState(() => LETRAS.map(() => new Animated.Value(0)));
  const [punto] = useState(() => new Animated.Value(0));
  const [reposo] = useState(() => new Animated.Value(0)); // logo completo, para "reducir movimiento"
  const [pulseAnim] = useState(() => new Animated.Value(0.4));
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [reducido, setReducido] = useState<boolean | null>(null);

  // ¿La persona pidió reducir el movimiento en su teléfono?
  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => {
        if (vivo) setReducido(r);
      })
      .catch(() => {
        if (vivo) setReducido(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (reducido === null) return;

    // Tiempo mínimo en pantalla para que la animación se aprecie completa.
    const timer = setTimeout(() => setMinTimeElapsed(true), reducido ? MINIMO_REDUCIDO : MINIMO_ANIMADO);

    // Con "reducir movimiento": solo un fundido del logo completo, sin movimientos.
    if (reducido) {
      Animated.timing(reposo, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      return () => clearTimeout(timer);
    }

    // 1. La casa aparece, 2. las ventanas, 3. las personas se asoman, 4. el arco naranja barre,
    // 5. las letras de "Barrio" una a una, 6. el punto de la "i" cae.
    const secuencia = Animated.parallel([
      tramo(casa, 0, 550, Easing.out(Easing.cubic)),
      tramo(ventanas, 350, 400, Easing.out(Easing.back(2))),
      ...personas.map((v, i) => tramo(v, 500 + i * 130, 520, Easing.out(Easing.back(1.6)))),
      tramo(arco, 900, 600, Easing.inOut(Easing.cubic), false), // ancho animado: sin driver nativo
      ...letras.map((v, i) => tramo(v, 1000 + i * 100, 450, Easing.out(Easing.cubic))),
      tramo(punto, 1650, 650, Easing.out(Easing.bounce)),
    ]);
    secuencia.start();

    // Pulso sutil en la barra indicadora, cuando la animación termina.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ]),
    );
    const inicioPulso = setTimeout(() => loop.start(), DURACION_ANIMADA);

    return () => {
      clearTimeout(timer);
      clearTimeout(inicioPulso);
      secuencia.stop();
      loop.stop();
    };
  }, [reducido, casa, ventanas, personas, arco, letras, punto, reposo, pulseAnim]);

  // Esperar tanto la hidratación del storage/sesión como el tiempo mínimo estético de presentación
  if (!hydrated || !minTimeElapsed) {
    const sube = (v: Animated.Value, desde: number) => ({
      opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [desde, 0] }) }],
    });
    const arcoCapa = CAPAS_LOGO.arco;

    return (
      <View style={styles.container}>
        <View style={styles.logo} accessible accessibilityRole="image" accessibilityLabel="Barrio">
          {reducido ? (
            <Animated.Image
              source={require('../../assets/brand/logo-barrio.png')}
              resizeMode="contain"
              style={[styles.logoCompleto, { opacity: reposo }]}
            />
          ) : (
            <>
              <Capa nombre="casa" style={sube(casa, 18)} />
              <Capa
                nombre="ventanas"
                style={{
                  opacity: ventanas,
                  transform: [{ scale: ventanas.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
                }}
              />
              {PERSONAS.map((n, i) => (
                <Capa key={n} nombre={n} style={sube(personas[i], 26)} />
              ))}
              {/* El arco se revela de izquierda a derecha con una ventana que se ensancha. */}
              <Animated.View
                style={{
                  position: 'absolute',
                  left: arcoCapa.x * K,
                  top: arcoCapa.y * K,
                  height: arcoCapa.h * K,
                  overflow: 'hidden',
                  width: arco.interpolate({ inputRange: [0, 1], outputRange: [0, arcoCapa.w * K] }),
                }}
              >
                <Image
                  source={arcoCapa.source}
                  resizeMode="contain"
                  accessible={false}
                  style={{ width: arcoCapa.w * K, height: arcoCapa.h * K }}
                />
              </Animated.View>
              {LETRAS.map((n, i) => (
                <Capa key={n} nombre={n} style={sube(letras[i], 16)} />
              ))}
              <Capa
                nombre="punto"
                style={{
                  opacity: punto.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 1] }),
                  transform: [{ translateY: punto.interpolate({ inputRange: [0, 1], outputRange: [-64, 0] }) }],
                }}
              />
            </>
          )}
        </View>

        {/* Indicador de carga estilizado tipo píldora pulsante */}
        <View style={styles.loaderContainer}>
          <Animated.View style={[styles.pulseIndicator, { opacity: reducido ? 0.4 : pulseAnim }]} />
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
  logo: {
    width: ANCHO,
    height: ALTO,
  },
  logoCompleto: {
    width: ANCHO,
    height: ALTO,
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
