import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { ProfessionalProfile } from '@/types';
import { oficioLabel } from '@/i18n/labels';
import { oficioIcon } from '@/i18n/icons';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts, radius } from '@/theme';
import { formatDistanceAndWalk } from '@/utils/geo';
import { Card } from './Card';
import { ValidationBadge } from './ValidationBadge';

type Props = {
  profile: ProfessionalProfile;
  distanceMeters?: number | null;
  onPress: () => void;
};

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ProfessionalCard({ profile, distanceMeters, onPress }: Props) {
  const p = usePalette();
  const distLabel = formatDistanceAndWalk(distanceMeters);
  const avatarUrl = profile.user.avatarUrl;

  return (
    <Card onPress={onPress}>
      <View style={styles.header}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{initialsOf(profile.user.fullName) || 'V'}</Text>
          </View>
        )}

        <View style={styles.headerInfo}>
          <Text style={[styles.name, { color: p.text }]} numberOfLines={1}>
            {profile.user.fullName}
          </Text>
          <View style={styles.oficioChip}>
            <Ionicons name={oficioIcon[profile.oficio.category]} size={13} color={colors.azul} />
            <Text style={styles.oficioText} numberOfLines={1}>
              {oficioLabel[profile.oficio.category]}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.gris} />
      </View>

      {profile.description ? (
        <Text numberOfLines={2} style={[styles.desc, { color: p.body }]}>
          {profile.description}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <ValidationBadge validatedCount={profile.validatedCount} />
        <View style={styles.metrics}>
          {profile.yearsExperience ? (
            <View style={styles.metric}>
              <Ionicons name="briefcase-outline" size={14} color={p.muted} />
              <Text style={[styles.metricText, { color: p.muted }]}>
                {profile.yearsExperience} {profile.yearsExperience === 1 ? 'año' : 'años'}
              </Text>
            </View>
          ) : null}
          {distLabel ? (
            <View style={styles.metric}>
              <Ionicons name="walk-outline" size={14} color={p.muted} />
              <Text style={[styles.metricText, { color: p.muted }]}>{distLabel}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.grisBorde },
  avatarFallback: { backgroundColor: colors.azul, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.blanco, fontFamily: fonts.bold, fontSize: 17 },
  headerInfo: { flex: 1, gap: 4 },
  name: { fontSize: 17, fontFamily: fonts.bold },
  oficioChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.azulSuave,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    maxWidth: '100%',
  },
  oficioText: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.azul, flexShrink: 1 },
  desc: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20, marginTop: 12 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.grisBorde,
  },
  metrics: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricText: { fontSize: 12, fontFamily: fonts.medium },
});
