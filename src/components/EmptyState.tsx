import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { usePalette } from '@/hooks/usePalette';
import { fonts, spacing } from '@/theme';
import type { IconName } from '@/i18n/icons';

type Props = { title: string; message: string; icon?: IconName };

export function EmptyState({ title, message, icon = 'leaf-outline' }: Props) {
  const p = usePalette();
  return (
    <View style={styles.wrap}>
      <View style={[styles.circle, { backgroundColor: p.highlight }]}>
        <Ionicons name={icon} size={38} color={p.text} />
      </View>
      <Text style={[styles.title, { color: p.text }]}>{title}</Text>
      <Text style={[styles.message, { color: p.muted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  circle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  title: { fontFamily: fonts.bold, fontSize: 19, marginBottom: 6, textAlign: 'center' },
  message: { fontFamily: fonts.regular, fontSize: 16, textAlign: 'center', lineHeight: 23 },
});
