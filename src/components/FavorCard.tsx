import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { Favor } from '@/types';
import { favorStatusLabel, favorTypeBackground, favorTypeLabel, syncStatusLabel } from '@/i18n/labels';
import { favorTypeColor, favorTypeIcon } from '@/i18n/icons';
import { usePalette } from '@/hooks/usePalette';
import { fonts } from '@/theme';
import { Card } from './Card';

type Props = { favor: Favor; onPress?: () => void };

export function FavorCard({ favor, onPress }: Props) {
  const p = usePalette();
  const pending = favor.syncStatus !== 'enviado';
  const statusText = pending ? syncStatusLabel[favor.syncStatus] : favorStatusLabel[favor.status];

  return (
    <Card onPress={onPress} backgroundColor={favorTypeBackground[favor.type]}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: favorTypeColor[favor.type] }]}>
          <Ionicons name={favorTypeIcon[favor.type]} size={22} color="#FFFFFF" />
        </View>
        <View style={styles.info}>
          <Text style={[styles.type, { color: p.muted }]}>{favorTypeLabel[favor.type]}</Text>
          <Text style={[styles.title, { color: p.text }]}>{favor.title}</Text>
        </View>
      </View>
      <View style={[styles.pill, { backgroundColor: pending ? '#FFF3DC' : '#FFFFFF' }]}>
        <Ionicons
          name={pending ? 'cloud-upload-outline' : 'checkmark-circle-outline'}
          size={14}
          color={pending ? '#8A5A00' : p.primary}
        />
        <Text style={[styles.status, { color: pending ? '#8A5A00' : p.primary }]}>{statusText}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  type: { fontFamily: fonts.semibold, fontSize: 14 },
  title: { fontFamily: fonts.bold, fontSize: 18, marginTop: 2 },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 12,
  },
  status: { fontFamily: fonts.semibold, fontSize: 14 },
});
