import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { Favor } from '@/types';
import { favorStatusLabel, favorTypeLabel, syncStatusLabel } from '@/i18n/labels';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts } from '@/theme';
import { Card } from './Card';

type Props = { favor: Favor; onPress?: () => void };

export function FavorCard({ favor, onPress }: Props) {
  const p = usePalette();
  const pending = favor.syncStatus !== 'enviado';
  const statusText = pending ? syncStatusLabel[favor.syncStatus] : favorStatusLabel[favor.status];

  return (
    <Card onPress={onPress}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={styles.type}>{favorTypeLabel[favor.type]}</Text>
            <Text style={[styles.title, { color: p.text }]} numberOfLines={2}>
              {favor.title}
            </Text>
          </View>
          {onPress ? <Ionicons name="chevron-forward" size={18} color="#94A3B8" /> : null}
        </View>

        {favor.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {favor.description}
          </Text>
        ) : null}

        <View style={styles.footerRow}>
          <View
            style={[
              styles.statusPill,
              pending ? styles.statusPending : styles.statusSent,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: pending ? '#8A5A00' : colors.azul },
              ]}
            >
              {statusText}
            </Text>
          </View>

          <View style={styles.metaRight}>
            <Text style={styles.authorText} numberOfLines={1}>
              Por {favor.author.fullName}
            </Text>
            {favor.interestedCount > 0 ? (
              <View style={styles.interestBadge}>
                <Text style={styles.interestText}>
                  {favor.interestedCount === 1
                    ? '1 interesado'
                    : `${favor.interestedCount} interesados`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerInfo: {
    flex: 1,
  },
  type: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.azul,
    marginBottom: 2,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  desc: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 19,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusSent: {
    backgroundColor: '#EEF5FD',
    borderColor: '#D0E3F8',
  },
  statusPending: {
    backgroundColor: '#FFF3DC',
    borderColor: '#FDE68A',
  },
  statusText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#64748B',
    maxWidth: 140,
  },
  interestBadge: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  interestText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.azul,
  },
});
