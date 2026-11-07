import { Pressable, StyleSheet, Text } from 'react-native';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts, radius } from '@/theme';

type Props = { label: string; selected: boolean; onPress: () => void };

export function Chip({ label, selected, onPress }: Props) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: p.highlight, borderColor: p.cta }
          : { backgroundColor: colors.blanco, borderColor: p.border },
      ]}
    >
      <Text style={[styles.text, { color: p.text, fontFamily: selected ? fonts.bold : fonts.medium }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    marginRight: 8,
    marginBottom: 8,
    justifyContent: 'center',
  },
  text: { fontSize: 15 },
});
