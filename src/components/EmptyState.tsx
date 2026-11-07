import { StyleSheet, Text, View } from 'react-native';
import { usePalette } from '@/hooks/usePalette';
import { fonts, spacing } from '@/theme';

type Props = { title: string; message: string };

export function EmptyState({ title, message }: Props) {
  const p = usePalette();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: p.text }]}>{title}</Text>
      <Text style={[styles.message, { color: p.muted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', padding: spacing.xl },
  title: { fontSize: 18, fontFamily: fonts.bold, marginBottom: 6, textAlign: 'center' },
  message: { fontFamily: fonts.regular, fontSize: 16, textAlign: 'center' },
});
