import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '@/theme';

type Props = {
  // Página actual, empezando en 1.
  page: number;
  // Si se conoce el total de páginas se muestra "de Y". Si no, solo "Página X".
  totalPages?: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
};

// Paginación única para Oficios (en cliente) y Ayudas (en servidor).
export function PaginationControls({ page, totalPages, hasPrev, hasNext, onPrev, onNext }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Página anterior"
        disabled={!hasPrev}
        onPress={onPrev}
        style={[styles.btn, !hasPrev && styles.btnDisabled]}
      >
        <Ionicons name="chevron-back" size={16} color={hasPrev ? colors.azul : colors.gris} />
        <Text style={[styles.btnText, !hasPrev && styles.btnTextDisabled]}>Anterior</Text>
      </Pressable>

      <Text style={styles.indicator}>
        {totalPages !== undefined ? `Página ${page} de ${totalPages}` : `Página ${page}`}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Página siguiente"
        disabled={!hasNext}
        onPress={onNext}
        style={[styles.btn, !hasNext && styles.btnDisabled]}
      >
        <Text style={[styles.btnText, !hasNext && styles.btnTextDisabled]}>Siguiente</Text>
        <Ionicons name="chevron-forward" size={16} color={hasNext ? colors.azul : colors.gris} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.xs,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.blanco,
    borderWidth: 1,
    borderColor: colors.grisBorde,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.azul,
  },
  btnTextDisabled: {
    color: colors.gris,
  },
  indicator: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.gris,
  },
});
