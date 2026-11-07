import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, shadow } from '@/theme';

type Props = { children: ReactNode; onPress?: () => void; backgroundColor?: string };

export function Card({ children, onPress, backgroundColor = colors.blanco }: Props) {
  const body = <View style={[styles.card, { backgroundColor }]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.9, transform: [{ scale: 0.99 }] } : null)}
    >
      {body}
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
