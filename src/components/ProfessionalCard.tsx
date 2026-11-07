import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { ProfessionalProfile } from '@/types';
import { oficioLabel } from '@/i18n/labels';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts } from '@/theme';
import { Card } from './Card';
import { ValidationBadge } from './ValidationBadge';

type Props = { profile: ProfessionalProfile; onPress: () => void };

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ProfessionalCard({ profile, onPress }: Props) {
  const p = usePalette();

  return (
    <Card onPress={onPress}>
      <View style={styles.headerRow}>
        <View style={[styles.avatar, { backgroundColor: colors.azul }]}>
          <Text style={styles.avatarText}>{initialsOf(profile.user.fullName) || 'V'}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.name, { color: p.text }]} numberOfLines={1}>
            {profile.user.fullName}
          </Text>
          <Text style={[styles.oficio, { color: p.muted }]}>{oficioLabel[profile.oficio.category]}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.gris} />
      </View>

      {profile.description ? (
        <Text numberOfLines={2} style={[styles.desc, { color: p.body }]}>
          {profile.description}
        </Text>
      ) : null}

      <View style={styles.footerRow}>
        <ValidationBadge validatedCount={profile.validatedCount} />
        {profile.yearsExperience ? (
          <View style={styles.metric}>
            <Ionicons name="briefcase-outline" size={15} color={colors.gris} />
            <Text style={[styles.metricText, { color: p.muted }]}>{profile.yearsExperience} años</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.blanco, fontFamily: fonts.bold, fontSize: 17 },
  headerInfo: { flex: 1 },
  name: { fontSize: 18, fontFamily: fonts.bold },
  oficio: { fontSize: 15, fontFamily: fonts.medium, marginTop: 1 },
  desc: { fontSize: 15, fontFamily: fonts.regular, lineHeight: 21, marginTop: 12 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricText: { fontSize: 14, fontFamily: fonts.medium },
});
