import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { favorUrgencyLabel } from '@/i18n/labels';
import { colors, fonts, radius } from '@/theme';
import type { FavorUrgency } from '@/types';

export function UrgencyBadge({ urgency }: { urgency: FavorUrgency }) {
  if (urgency === 'normal') return null;
  const emergencia = urgency === 'emergencia';
  // Mismos pares de contraste que el botón de acción de la paleta.
  const fg = emergencia ? colors.blanco : colors.azul;
  return (
    <View style={[styles.badge, { backgroundColor: emergencia ? colors.rojo : colors.naranja }]}>
      <Ionicons name={emergencia ? 'warning' : 'alert-circle'} size={14} color={fg} />
      <Text style={[styles.text, { color: fg }]}>{favorUrgencyLabel[urgency]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 6,
  },
  text: { fontFamily: fonts.bold, fontSize: 13 },
});
