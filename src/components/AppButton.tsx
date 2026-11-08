import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePalette } from '@/hooks/usePalette';
import type { IconName } from '@/i18n/icons';
import { colors, fonts, radius, touch } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  // primary y accent son la misma acción principal (naranja); se mantienen ambos por compatibilidad.
  variant?: 'primary' | 'secondary' | 'accent' | 'link' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
};

export function AppButton({ label, onPress, variant = 'primary', disabled = false, loading = false, icon }: Props) {
  const p = usePalette();
  const isDisabled = disabled || loading;
  const isMain = variant === 'primary' || variant === 'accent';
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';
  const isLink = variant === 'link';
  const isSuccess = variant === 'success';

  const bg = isMain ? p.cta : isSecondary ? colors.azulSuave : isDanger ? colors.rojo : isSuccess ? colors.verdeExito : 'transparent';
  const fg = isMain ? p.ctaText : isDanger || isSuccess ? colors.blanco : p.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg },
        isLink && styles.link,
        isDisabled && styles.disabled,
        pressed && !isDisabled && { opacity: 0.88, transform: [{ scale: 0.985 }] },
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : icon ? (
          <Ionicons name={icon} size={20} color={fg} />
        ) : null}
        <Text style={[styles.label, { color: fg }, isLink && styles.linkLabel]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.min + 6,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { minHeight: 44, paddingVertical: 8 },
  disabled: { opacity: 0.45 },
  label: { fontSize: 17, fontFamily: fonts.bold, letterSpacing: 0.1 },
  linkLabel: { fontFamily: fonts.semiBold, textDecorationLine: 'underline' },
});
