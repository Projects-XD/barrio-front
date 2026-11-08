import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { selectEmergencyActive, useAppStore } from '@/store/app-store';
import { colors } from '@/theme';

interface EmergencyFabProps {
  top: number;
}

const ONDAS = 3;
const DURACION_MS = 2000;
const DESFASE_MS = 650;

// Ondas que salen del botón mientras hay una emergencia activa en la zona. Cada onda crece y se
// desvanece; las tres van desfasadas para que el efecto sea continuo. Con "reducir movimiento"
// del sistema se deja un halo fijo, sin animación.
function Ondas() {
  const [valores] = useState(() => Array.from({ length: ONDAS }, () => new Animated.Value(0)));
  const [reducido, setReducido] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const animaciones: Animated.CompositeAnimation[] = [];

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reducir) => {
        if (cancelado) return;
        if (reducir) {
          setReducido(true);
          return;
        }
        valores.forEach((valor, i) => {
          valor.setValue(0);
          const animacion = Animated.sequence([
            Animated.delay(i * DESFASE_MS),
            Animated.loop(
              Animated.timing(valor, {
                toValue: 1,
                duration: DURACION_MS,
                easing: Easing.out(Easing.quad),
                useNativeDriver: Platform.OS !== 'web',
              })
            ),
          ]);
          animaciones.push(animacion);
          animacion.start();
        });
      })
      .catch(() => {});

    return () => {
      cancelado = true;
      animaciones.forEach((a) => a.stop());
    };
  }, [valores]);

  if (reducido) return <Animated.View pointerEvents="none" style={[styles.onda, styles.ondaFija]} />;

  return (
    <>
      {valores.map((valor, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.onda,
            {
              opacity: valor.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: valor.interpolate({ inputRange: [0, 1], outputRange: [1, 2.3] }) }],
            },
          ]}
        />
      ))}
    </>
  );
}

// Botón circular de emergencia, arriba a la derecha, siempre visible.
export function EmergencyFab({ top }: EmergencyFabProps) {
  const activa = useAppStore(selectEmergencyActive);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={activa ? 'Emergencia activa: ver apoyos disponibles' : 'Emergencia: ver apoyos disponibles'}
      onPress={() => router.push('/emergencia')}
      style={({ pressed }) => [styles.fab, { top, opacity: pressed ? 0.85 : 1 }]}
    >
      {activa ? <Ondas /> : null}
      <Ionicons name="alert-circle" size={26} color={colors.blanco} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.rojo,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 10,
  },
  onda: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.rojo,
  },
  ondaFija: {
    opacity: 0.25,
    transform: [{ scale: 1.5 }],
  },
});
