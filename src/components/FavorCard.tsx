import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { Favor } from '@/types';
import { favorStatusLabel, favorTypeLabel, syncStatusLabel } from '@/i18n/labels';
import { favorTypeIcon, type IconName } from '@/i18n/icons';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts, radius } from '@/theme';
import { timeAgo } from '@/utils/time';
import { Card } from './Card';
import { UrgencyBadge } from './UrgencyBadge';

type Props = { favor: Favor; onPress?: () => void };

export function FavorCard({ favor, onPress }: Props) {
  const p = usePalette();
  // Sin enviar tiene prioridad: la cola offline también marca sus favores como 'pendiente'.
  // Un favor en revisión solo llega al feed de su autor: el backend lo filtra para los demás.
  const pill: { bg: string; fg: string; icon: IconName; iconSize: number; text: string } =
    favor.syncStatus !== 'enviado'
      ? { bg: colors.naranjaSuave, fg: colors.azul, icon: 'cloud-upload-outline', iconSize: 14, text: syncStatusLabel[favor.syncStatus] }
      : favor.moderationStatus === 'pendiente'
        ? { bg: colors.naranja, fg: colors.azul, icon: 'time-outline', iconSize: 14, text: 'En revisión' }
        : { bg: colors.verdeExitoSuave, fg: colors.verdeExito, icon: 'ellipse', iconSize: 8, text: favorStatusLabel[favor.status] };
  const meta = [favor.author.fullName, timeAgo(favor.createdAt)].filter(Boolean).join(' · ');

  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: p.highlight }]}>
          <Ionicons name={favorTypeIcon[favor.type]} size={24} color={p.text} />
        </View>
        <View style={styles.info}>
          {favor.moderationStatus === 'aprobado' ? <UrgencyBadge urgency={favor.urgency} /> : null}
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
        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
          <Ionicons name={pill.icon} size={pill.iconSize} color={pill.fg} />
          <Text style={[styles.status, { color: pill.fg }]}>{pill.text}</Text>
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
