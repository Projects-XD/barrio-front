import { Pressable, StyleSheet, Text } from 'react-native';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts, radius, touch } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'link';
  disabled?: boolean;
};

export function AppButton({ label, onPress, variant = 'primary', disabled = false }: Props) {
  const p = usePalette();
  const isPrimary = variant === 'primary';
  const isAccent = variant === 'accent';
  const isSecondary = variant === 'secondary';
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
        isPrimary && { backgroundColor: p.primary },
        isAccent && { backgroundColor: p.accent },
        isSecondary && {
          backgroundColor: colors.blanco,
          borderWidth: 1.5,
          borderColor: p.border,
        },
        isLink && styles.link,
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}
    >
      <Text
        style={[
          styles.label,
          (isPrimary || isAccent) && { color: colors.blanco },
          isSecondary && { color: p.primary },
          isLink && [styles.linkLabel, { color: p.primary }],
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
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  link: { backgroundColor: 'transparent', minHeight: 40 },
  disabled: { opacity: 0.45 },
  label: { fontSize: 17, fontFamily: fonts.semiBold, letterSpacing: 0.2 },
  linkLabel: { textDecorationLine: 'underline' },
});
