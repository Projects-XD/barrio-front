import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/theme';

type Props = { validatedCount: number; threshold?: number };

export function ValidationBadge({ validatedCount, threshold = 2 }: Props) {
  const isValidated = validatedCount >= threshold;

  if (isValidated) {
    return (
      <View style={styles.validado}>
        <Text style={styles.validadoText}>✓ Validado por vecinos ({validatedCount})</Text>
      </View>
    );
  }

  return (
    <View style={styles.pendiente}>
      <Text style={styles.pendienteText}>{`🤝 ${validatedCount} de ${threshold} vistos buenos necesarios`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  validado: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0ECFB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#BDD7F5',
  },
  validadoText: {
    color: colors.azul,
    fontSize: 13,
    fontFamily: fonts.semiBold,
  },
  pendiente: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.grisBorde,
  },
  pendienteText: {
    color: colors.gris,
    fontSize: 13,
    fontFamily: fonts.medium,
  },
});
