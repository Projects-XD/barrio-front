import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '@/theme';

type Props = { validatedCount: number; threshold?: number };

// Verde con escudo = validado por vecinos. Gris = aún le faltan vistos buenos.
export function ValidationBadge({ validatedCount, threshold = 2 }: Props) {
  const ok = validatedCount >= threshold;
  return (
    <View style={[styles.badge, { backgroundColor: ok ? colors.verdeExitoSuave : colors.naranjaClaro }]}>
      <Ionicons
        name={ok ? 'shield-checkmark' : 'shield-outline'}
        size={15}
        color={ok ? colors.verdeExito : colors.gris}
      />
      <Text style={[styles.text, { color: ok ? colors.verdeExito : colors.gris }]}>
        {ok ? `Validado por ${validatedCount} vecinos` : `${validatedCount} de ${threshold} vistos buenos`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 14, fontFamily: fonts.semiBold },
});
