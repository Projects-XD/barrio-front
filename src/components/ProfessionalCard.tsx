import { fonts } from '@/theme';
import { StyleSheet, Text, View } from 'react-native';
import type { ProfessionalProfile } from '@/types';
import { oficioLabel } from '@/i18n/labels';
import { usePalette } from '@/hooks/usePalette';
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
        <View style={[styles.avatar, { backgroundColor: p.border }]}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: p.text }]}>{profile.user.fullName}</Text>
          <Text style={{ color: p.muted }}>
            {`${oficioLabel[profile.oficio.category]}${profile.distanceKm !== undefined ? ` · ${profile.distanceKm} km` : ''}`}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.bold, fontSize: 16 },
  info: { flex: 1 },
  name: { fontSize: 18, fontFamily: fonts.bold },
  badge: { marginTop: 6 },
});
