import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { Favor } from '@/types';
import { favorStatusLabel, favorTypeLabel, syncStatusLabel } from '@/i18n/labels';
import { favorTypeIcon } from '@/i18n/icons';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts, radius } from '@/theme';
import { timeAgo } from '@/utils/time';
import { Card } from './Card';

type Props = { favor: Favor; onPress?: () => void };

export function FavorCard({ favor, onPress }: Props) {
  const p = usePalette();
  const pending = favor.syncStatus !== 'enviado';
  const statusText = pending ? syncStatusLabel[favor.syncStatus] : favorStatusLabel[favor.status];
  const meta = [favor.author.fullName, timeAgo(favor.createdAt)].filter(Boolean).join(' · ');

  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: p.highlight }]}>
          <Ionicons name={favorTypeIcon[favor.type]} size={24} color={p.text} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.type, { color: p.muted }]}>{favorTypeLabel[favor.type]}</Text>
          <Text style={[styles.title, { color: p.text }]} numberOfLines={2}>
            {favor.title}
          </Text>
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={20} color={colors.gris} /> : null}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.meta, { color: p.muted }]} numberOfLines={1}>
          {meta}
        </Text>
        <View style={[styles.pill, { backgroundColor: pending ? colors.naranjaSuave : colors.verdeExitoSuave }]}>
          <Ionicons
            name={pending ? 'cloud-upload-outline' : 'ellipse'}
            size={pending ? 14 : 8}
            color={pending ? colors.azul : colors.verdeExito}
          />
          <Text style={[styles.status, { color: pending ? colors.azul : colors.verdeExito }]}>{statusText}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  type: { fontFamily: fonts.semiBold, fontSize: 14 },
  title: { fontFamily: fonts.bold, fontSize: 18, marginTop: 2, lineHeight: 24 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 14,
  },
  meta: { flex: 1, fontFamily: fonts.regular, fontSize: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  status: { fontFamily: fonts.semiBold, fontSize: 14 },
});
