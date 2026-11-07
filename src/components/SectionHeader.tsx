import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePalette } from '@/hooks/usePalette';
import { fonts, spacing } from '@/theme';

type Props = { title: string; actionLabel?: string; onAction?: () => void };

export function SectionHeader({ title, actionLabel, onAction }: Props) {
  const p = usePalette();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: p.text }]}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}>
          <Text style={[styles.action, { color: p.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  title: { fontFamily: fonts.bold, fontSize: 20 },
  action: { fontFamily: fonts.semiBold, fontSize: 15 },
});
