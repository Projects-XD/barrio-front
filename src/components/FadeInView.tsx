import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  // Posición en la lista: cada elemento entra 50 ms después del anterior (tope de 6).
  index?: number;
  // Si se indica, reemplaza el retraso calculado por `index`.
  delay?: number;
  // Desplazamiento vertical inicial, en px.
  distance?: number;
  style?: StyleProp<ViewStyle>;
};

// Entrada suave: aparece con un fundido y sube unos píxeles. Respeta "reducir movimiento" del sistema.
export function FadeInView({ children, index = 0, delay, distance = 10, style }: Props) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let cancelled = false;
    let anim: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reducir) => {
        if (cancelled) return;
        if (reducir) {
          progress.setValue(1);
          return;
        }
        anim = Animated.timing(progress, {
          toValue: 1,
          duration: 280,
          delay: delay ?? Math.min(index, 6) * 50,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        });
        anim.start();
      })
      .catch(() => progress.setValue(1));

    return () => {
      cancelled = true;
      anim?.stop();
    };
  }, [progress, index, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
