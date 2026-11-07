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

  return (
    <Card onPress={onPress}>
      <View style={styles.container}>
        {/* Cabecera: Nombre y Oficio destacados directamente sin avatar */}
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={[styles.name, { color: p.text }]}>{profile.user.fullName}</Text>
            <Text style={styles.oficio}>{oficioLabel[profile.oficio.category]}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </View>

        {/* Descripción del servicio */}
        {profile.description ? (
          <Text numberOfLines={2} style={styles.desc}>
            {profile.description}
          </Text>
        ) : null}

        {/* Fila inferior: Avales minimalistas a la izquierda, distancia y experiencia con presencia a la derecha */}
        <View style={styles.footerRow}>
          <ValidationBadge validatedCount={profile.validatedCount} />

          <View style={styles.metricsRow}>
            {profile.distanceKm !== undefined ? (
              <View style={styles.metricBadge}>
                <Ionicons name="location-outline" size={13} color={colors.azul} />
                <Text style={styles.metricText}>{profile.distanceKm} km</Text>
              </View>
            ) : null}

            {profile.yearsExperience ? (
              <View style={styles.metricBadge}>
                <Ionicons name="briefcase-outline" size={13} color={colors.azul} />
                <Text style={styles.metricText}>{profile.yearsExperience} años exp.</Text>
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
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerInfo: {
    flex: 1,
    paddingRight: 8,
  },
  name: {
    fontSize: 17.5,
    fontFamily: fonts.bold,
    letterSpacing: -0.2,
  },
  oficio: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.azul,
    marginTop: 2,
  },
  desc: {
    fontSize: 13.5,
    fontFamily: fonts.regular,
    color: '#475569',
    lineHeight: 18.5,
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
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: '#334155',
  },
});
