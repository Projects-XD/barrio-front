import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/theme';

type Props = { validatedCount: number; threshold?: number };

export function ValidationBadge({ validatedCount, threshold = 2 }: Props) {
  const isValidated = validatedCount >= threshold;

  return (
    <View style={[styles.badge, isValidated ? styles.validado : styles.pendiente]}>
      <Text style={[styles.badgeText, isValidated ? styles.validadoText : styles.pendienteText]}>
        {isValidated
          ? `${validatedCount} avales vecinales`
          : `${validatedCount} de ${threshold} avales`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  validado: {
    backgroundColor: '#EEF5FD',
    borderColor: '#D0E3F8',
  },
  pendiente: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  badgeText: {
    fontSize: 12,
  },
  validadoText: {
    color: colors.azul,
    fontFamily: fonts.semiBold,
  },
  pendienteText: {
    color: '#64748B',
    fontFamily: fonts.medium,
  },
});
