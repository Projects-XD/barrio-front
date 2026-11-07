import { Pressable, StyleSheet, Text } from 'react-native';
import { usePalette } from '@/hooks/usePalette';
import { colors, radius } from '@/theme';

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
        { borderColor: selected ? p.primary : p.border, backgroundColor: selected ? p.primary : colors.blanco },
      ]}
    >
      <Text style={[styles.text, { color: selected ? colors.blanco : p.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
    justifyContent: 'center',
  },
  text: { fontSize: 16, fontWeight: '600' },
});
