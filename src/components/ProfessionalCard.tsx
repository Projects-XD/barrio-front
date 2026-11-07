import { StyleSheet, Text, View } from 'react-native';
import type { ProfessionalProfile } from '@/types';
import { oficioLabel } from '@/i18n/labels';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts } from '@/theme';
import { Card } from './Card';
import { ValidationBadge } from './ValidationBadge';

type Props = { profile: ProfessionalProfile; onPress: () => void };

export function ProfessionalCard({ profile, onPress }: Props) {
  const p = usePalette();
  const initials = profile.user.fullName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: colors.azul }]}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: p.text }]}>{profile.user.fullName}</Text>
          <Text style={[styles.category, { color: p.muted }]}>
            {`${oficioLabel[profile.oficio.category]}${profile.yearsExperience ? ` · ${profile.yearsExperience} años exp.` : ''}${profile.distanceKm !== undefined ? ` · ${profile.distanceKm} km` : ''}`}
          </Text>
          <View style={styles.badge}>
            <ValidationBadge validatedCount={profile.validatedCount} />
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.blanco,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  info: { flex: 1 },
  name: { fontSize: 18, fontFamily: fonts.bold, marginBottom: 2 },
  category: { fontSize: 14, fontFamily: fonts.regular, marginBottom: 4 },
  badge: { marginTop: 4 },
});
