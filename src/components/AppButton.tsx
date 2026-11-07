import { Pressable, StyleSheet, Text } from 'react-native';
import { usePalette } from '@/hooks/usePalette';
import { fonts, colors, radius, touch } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'link';
  disabled?: boolean;
};

export function AppButton({ label, onPress, variant = 'primary', disabled = false }: Props) {
  const p = usePalette();
  const isPrimary = variant === 'primary';
  const isLink = variant === 'link';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        isPrimary && { backgroundColor: p.cta },
        variant === 'secondary' && { backgroundColor: colors.blanco, borderWidth: 2, borderColor: p.border },
        isLink && styles.link,
        disabled && styles.disabled,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: isPrimary ? p.ctaText : p.primary },
          isLink && styles.linkLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.min,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  link: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.45 },
  label: { fontSize: 18, fontFamily: fonts.semibold },
  linkLabel: { textDecorationLine: 'underline' },
});
