import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

type Props = { validatedCount: number; threshold?: number };

export function ValidationBadge({ validatedCount, threshold = 2 }: Props) {
  if (validatedCount >= threshold) {
    return (
      <View style={styles.validado}>
        <Text style={styles.validadoText}>Validado</Text>
      </View>
    );
  }
  return <Text style={styles.pendiente}>{`${validatedCount} de ${threshold} vistos buenos`}</Text>;
}

const styles = StyleSheet.create({
  validado: {
    alignSelf: 'flex-start',
    backgroundColor: colors.verdeSuave,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  validadoText: { color: '#1F4D38', fontSize: 14, fontWeight: '600' },
  pendiente: { color: colors.gris, fontSize: 15 },
});
