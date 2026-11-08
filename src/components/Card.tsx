import { useState, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, shadow } from '@/theme';

type Props = { children: ReactNode; onPress?: () => void; backgroundColor?: string };

export function Card({ children, onPress, backgroundColor = colors.blanco }: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const body = <View style={[styles.card, { backgroundColor }]}>{children}</View>;
  if (!onPress) return body;

  // Al presionar se encoge un poco con un resorte sin rebote, y vuelve al soltar.
  const animarA = (valor: number) =>
    Animated.spring(scale, {
      toValue: valor,
      speed: 32,
      bounciness: 0,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => animarA(0.98)}
      onPressOut={() => animarA(1)}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          opacity: scale.interpolate({ inputRange: [0.98, 1], outputRange: [0.92, 1], extrapolate: 'clamp' }),
        }}
      >
        {body}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    ...shadow,
  },
});
