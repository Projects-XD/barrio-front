import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { IconName } from '@/i18n/icons';
import { colors, fonts, radius } from '@/theme';

type Props = { variant: 'emergencia' | 'offline'; visible: boolean };

const variants: Record<Props['variant'], { text: string; bg: string; fg: string; icon: IconName }> = {
  emergencia: {
    text: 'Tu zona está en modo emergencia',
    bg: colors.rojoSuave,
    fg: colors.rojo,
    icon: 'alert-circle',
  },
  offline: {
    text: 'Sin conexión. Lo que publiques se enviará al volver la red.',
    bg: colors.naranjaSuave,
    fg: colors.azul,
    icon: 'cloud-offline-outline',
  },
};

export function StatusBanner({ variant, visible }: Props) {
  if (!visible) return null;
  const v = variants[variant];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: v.bg }]}>
      <Ionicons name={v.icon} size={20} color={v.fg} />
      <Text style={[styles.text, { color: v.fg }]}>{v.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  text: { flex: 1, fontFamily: fonts.semiBold, fontSize: 15, lineHeight: 20 },
});
