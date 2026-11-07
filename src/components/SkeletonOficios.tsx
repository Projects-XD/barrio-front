import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';

export function SkeletonOficios({ count = 4 }: { count?: number }) {
  const [pulseAnim] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.topRow}>
            {/* Avatar / Iniciales esqueleto */}
            <Animated.View style={[styles.avatar, { opacity: pulseAnim }]} />
            <View style={styles.headerTextCol}>
              {/* Nombre esqueleto */}
              <Animated.View style={[styles.nameLine, { opacity: pulseAnim }]} />
              {/* Oficio esqueleto */}
              <Animated.View style={[styles.categoryLine, { opacity: pulseAnim }]} />
            </View>
          </View>

          {/* Líneas de descripción */}
          <Animated.View style={[styles.descLine1, { opacity: pulseAnim }]} />
          <Animated.View style={[styles.descLine2, { opacity: pulseAnim }]} />

          {/* Badges inferiores */}
          <View style={styles.bottomRow}>
            <Animated.View style={[styles.badgeSkeleton, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.yearsSkeleton, { opacity: pulseAnim }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.blanco,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.grisBorde,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(19, 46, 102, 0.12)',
    marginRight: spacing.sm,
  },
  headerTextCol: {
    flex: 1,
    gap: 6,
  },
  nameLine: {
    width: '55%',
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(19, 46, 102, 0.12)',
  },
  categoryLine: {
    width: '35%',
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(19, 46, 102, 0.08)',
  },
  descLine1: {
    width: '100%',
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(19, 46, 102, 0.07)',
    marginBottom: 6,
  },
  descLine2: {
    width: '70%',
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(19, 46, 102, 0.07)',
    marginBottom: spacing.sm,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  badgeSkeleton: {
    width: 130,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(46, 125, 91, 0.15)',
  },
  yearsSkeleton: {
    width: 60,
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(19, 46, 102, 0.08)',
  },
});
