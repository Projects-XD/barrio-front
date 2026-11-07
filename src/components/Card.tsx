import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme';

type Props = { children: ReactNode; onPress?: () => void; backgroundColor?: string };

export function Card({ children, onPress, backgroundColor = colors.blanco }: Props) {
  const body = <View style={[styles.card, { backgroundColor }]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
