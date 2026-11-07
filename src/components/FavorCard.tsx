import { fonts } from '@/theme';
import { StyleSheet, Text } from 'react-native';
import type { Favor } from '@/types';
import { favorStatusLabel, favorTypeBackground, favorTypeLabel, syncStatusLabel } from '@/i18n/labels';
import { usePalette } from '@/hooks/usePalette';
import { Card } from './Card';

type Props = { favor: Favor; onPress?: () => void };

export function FavorCard({ favor, onPress }: Props) {
  const p = usePalette();
  return (
    <Card onPress={onPress} backgroundColor={favorTypeBackground[favor.type]}>
      <Text style={[styles.type, { color: p.muted }]}>{favorTypeLabel[favor.type]}</Text>
      <Text style={[styles.title, { color: p.text }]}>{favor.title}</Text>
      <Text style={[styles.status, { color: p.text }]}>
        {favor.syncStatus === 'enviado' ? favorStatusLabel[favor.status] : syncStatusLabel[favor.syncStatus]}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  type: { fontSize: 14, fontFamily: fonts.semibold },
  title: { fontSize: 18, fontFamily: fonts.bold, marginTop: 4 },
  status: { fontSize: 15, fontFamily: fonts.semibold, marginTop: 8 },
});
