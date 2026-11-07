import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '@/theme';

type Props = { validatedCount: number; threshold?: number };

export function ValidationBadge({ validatedCount, threshold = 2 }: Props) {
  const isValidated = validatedCount >= threshold;

  if (isValidated) {
    return (
      <View style={styles.validado}>
        <Ionicons name="shield-checkmark" size={13} color={colors.azul} style={styles.icon} />
        <Text style={styles.validadoText}>
          {validatedCount > threshold ? `${validatedCount} avales vecinales` : 'Validado por vecinos'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.pendiente}>
      <View style={styles.dotsRow}>
        <View style={[styles.dot, { backgroundColor: validatedCount >= 1 ? colors.naranja : colors.grisBorde }]} />
        <View style={[styles.dot, { backgroundColor: validatedCount >= 2 ? colors.naranja : colors.grisBorde }]} />
      </View>
      <Text style={styles.pendienteText}>
        {`${validatedCount}/${threshold} avales`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  validado: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E8F1FC',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#C8DEF8',
  },
  icon: {
    marginRight: 4,
  },
  validadoText: {
    color: colors.azul,
    fontSize: 12,
    fontFamily: fonts.semiBold,
  },
  pendiente: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.grisBorde,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginRight: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pendienteText: {
    color: colors.gris,
    fontSize: 12,
    fontFamily: fonts.medium,
  },
});
