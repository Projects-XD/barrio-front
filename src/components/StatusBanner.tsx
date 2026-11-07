import { StyleSheet, Text } from 'react-native';
import { colors } from '@/theme';

type Props = { variant: 'emergencia' | 'offline'; visible: boolean };

const messages = {
  emergencia: { text: 'Modo emergencia activo', bg: colors.rojo, color: colors.blanco },
  offline: { text: 'Sin conexión. Tus publicaciones se enviarán al volver la red.', bg: colors.ambar, color: colors.carbon },
};

export function StatusBanner({ variant, visible }: Props) {
  if (!visible) return null;
  const m = messages[variant];
  return (
    <Text accessibilityRole="alert" style={[styles.banner, { backgroundColor: m.bg, color: m.color }]}>
      {m.text}
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: { textAlign: 'center', padding: 10, fontWeight: '700', fontSize: 15 },
});
