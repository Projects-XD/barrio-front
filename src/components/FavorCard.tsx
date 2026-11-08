import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { Favor } from '@/types';
import { favorTypeLabel } from '@/i18n/labels';
import { favorTypeIcon } from '@/i18n/icons';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts, radius } from '@/theme';
import { timeAgo } from '@/utils/time';
import { Card } from './Card';
import { useAppStore } from '@/store/app-store';

type Props = { favor: Favor; onPress?: () => void };

/**
 * Quita los prefijos "Necesito:" / "Ofrezco:" que a veces vienen dentro del título,
 * porque la etiqueta de intención ya lo muestra.
 */
function cleanDisplayTitle(title: string): string {
  const stripped = title.replace(/^(?:Necesito|Ofrezco)(?:\s*\([^)]*\))?:\s*/i, '').trim();
  return stripped || title;
}

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function FavorCard({ favor, onPress }: Props) {
  const p = usePalette();
  const userId = useAppStore((s) => s.userId);
  const esMio = Boolean(userId && favor.authorId === userId);
  const esOfrecimiento = favor.intent === 'ofrecer';

  const intentColor = esOfrecimiento ? colors.verdeExito : colors.naranja;
  const intentSoft = esOfrecimiento ? colors.verdeExitoSuave : colors.naranjaSuave;
  const intentLabel = esOfrecimiento ? 'Ofrece' : 'Pide';
  const authorName = esMio ? 'Tú' : favor.author.fullName;
  const pendiente = favor.syncStatus !== 'enviado';
  const enRevision = !pendiente && favor.moderationStatus === 'pendiente';

  return (
    <Card onPress={onPress}>
      <View style={styles.topRow}>
        <View style={[styles.intentChip, { backgroundColor: intentSoft }]}>
          <Text style={[styles.intentText, { color: intentColor }]}>{intentLabel}</Text>
        </View>
        <View style={styles.categoryRow}>
          <Ionicons name={favorTypeIcon[favor.type]} size={14} color={p.muted} />
          <Text style={[styles.categoryText, { color: p.muted }]} numberOfLines={1}>
            {favorTypeLabel[favor.type]}
          </Text>
        </View>
        {esMio ? (
          <View style={styles.mineTag}>
            <Text style={styles.mineText}>Tuya</Text>
          </View>
        ) : null}
        <Text style={[styles.time, { color: p.muted }]}>{timeAgo(favor.createdAt)}</Text>
      </View>

      <Text style={[styles.title, { color: p.text }]} numberOfLines={2}>
        {cleanDisplayTitle(favor.title)}
      </Text>

      {favor.description ? (
        <Text style={[styles.desc, { color: p.muted }]} numberOfLines={2}>
          {favor.description}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.authorRow}>
          <View style={styles.authorAvatar}>
            <Text style={styles.authorInitials}>{initialsOf(favor.author.fullName) || 'V'}</Text>
          </View>
          <Text style={[styles.author, { color: esMio ? colors.azul : p.text }]} numberOfLines={1}>
            {authorName}
          </Text>
        </View>

        <View style={styles.footerRight}>
          {pendiente ? (
            <View style={[styles.statusPill, { backgroundColor: colors.naranjaSuave }]}>
              <Text style={[styles.statusText, { color: colors.naranja }]}>Sin conexión</Text>
            </View>
          ) : enRevision ? (
            <View style={[styles.statusPill, { backgroundColor: colors.grisBorde }]}>
              <Text style={[styles.statusText, { color: colors.gris }]}>En revisión</Text>
            </View>
          ) : favor.interestedCount > 0 ? (
            <View style={styles.metric}>
              <Ionicons name="people-outline" size={14} color={p.muted} />
              <Text style={[styles.metricText, { color: p.muted }]}>
                {favor.interestedCount === 1 ? '1 interesado' : `${favor.interestedCount} interesados`}
              </Text>
            </View>
          ) : null}
          {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.gris} /> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  intentChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  intentText: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.3 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  categoryText: { fontFamily: fonts.medium, fontSize: 12, flexShrink: 1 },
  mineTag: {
    backgroundColor: colors.azulSuave,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  mineText: { fontFamily: fonts.semiBold, fontSize: 10, color: colors.azul },
  time: { fontFamily: fonts.regular, fontSize: 12, marginLeft: 'auto' },
  title: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 23 },
  desc: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, marginTop: 6 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.grisBorde,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  authorAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.azulSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorInitials: { fontFamily: fonts.bold, fontSize: 10, color: colors.azul },
  author: { fontFamily: fonts.medium, fontSize: 13, flexShrink: 1 },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricText: { fontFamily: fonts.regular, fontSize: 12 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  statusText: { fontFamily: fonts.semiBold, fontSize: 11 },
});
