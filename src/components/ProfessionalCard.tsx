import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
      <View style={styles.container}>
        <View style={styles.topRow}>
          <View style={[styles.avatar, { backgroundColor: '#EBF3FC', borderColor: '#D0E3F8' }]}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <View style={styles.mainInfo}>
            <View style={styles.nameCategoryRow}>
              <Text style={[styles.name, { color: p.text }]}>{profile.user.fullName}</Text>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{oficioLabel[profile.oficio.category]}</Text>
              </View>
            </View>
            <Text numberOfLines={1} style={styles.desc}>
              {profile.description}
            </Text>
          </View>
        </View>

        <View style={styles.bottomRow}>
          <ValidationBadge validatedCount={profile.validatedCount} />

          <View style={styles.metaRow}>
            {profile.distanceKm !== undefined ? (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={13} color={colors.gris} />
                <Text style={styles.metaText}>{profile.distanceKm} km</Text>
              </View>
            ) : null}

            {profile.yearsExperience ? (
              <View style={styles.metaItem}>
                <Ionicons name="briefcase-outline" size={12} color={colors.gris} />
                <Text style={styles.metaText}>{profile.yearsExperience}a exp</Text>
              </View>
            ) : null}

            <Ionicons name="chevron-forward" size={16} color={colors.grisBorde} style={{ marginLeft: 2 }} />
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  initials: {
    color: colors.azul,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  mainInfo: {
    flex: 1,
  },
  nameCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    fontSize: 17,
    fontFamily: fonts.bold,
    flex: 1,
    marginRight: 8,
  },
  tag: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.grisBorde,
  },
  tagText: {
    fontSize: 11.5,
    fontFamily: fonts.semiBold,
    color: colors.azul,
  },
  desc: {
    fontSize: 13.5,
    fontFamily: fonts.regular,
    color: colors.gris,
    lineHeight: 18,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.gris,
  },
});
