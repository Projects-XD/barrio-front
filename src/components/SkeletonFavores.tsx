import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';

export function SkeletonFavores({ count = 4 }: { count?: number }) {
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
          <View style={styles.row}>
            {/* Ícono circular del favor */}
            <Animated.View style={[styles.iconCircle, { opacity: pulseAnim }]} />
            <View style={styles.infoCol}>
              {/* Tipo de favor */}
              <Animated.View style={[styles.typeLine, { opacity: pulseAnim }]} />
              {/* Título línea 1 */}
              <Animated.View style={[styles.titleLine1, { opacity: pulseAnim }]} />
              {/* Título línea 2 */}
              <Animated.View style={[styles.titleLine2, { opacity: pulseAnim }]} />
            </View>
          </View>

          {/* Pie de tarjeta: autor/fecha + pill de estado */}
          <View style={styles.footer}>
            <Animated.View style={[styles.metaLine, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.statusPill, { opacity: pulseAnim }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SkeletonFavorDetalle() {
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
    <View style={styles.detailWrap}>
      <View style={styles.detailCard}>
        <Animated.View style={[styles.urgencyBadge, { opacity: pulseAnim }]} />
        <Animated.View style={[styles.typeLine, { opacity: pulseAnim, marginTop: spacing.xs }]} />
        <Animated.View style={[styles.detailTitle1, { opacity: pulseAnim }]} />
        <Animated.View style={[styles.detailTitle2, { opacity: pulseAnim }]} />
        <Animated.View style={[styles.detailDesc1, { opacity: pulseAnim }]} />
        <Animated.View style={[styles.detailDesc2, { opacity: pulseAnim }]} />
        <View style={styles.detailMeta}>
          <Animated.View style={[styles.metaLine, { opacity: pulseAnim }]} />
          <Animated.View style={[styles.typeLine, { opacity: pulseAnim }]} />
        </View>
      </View>
      <Animated.View style={[styles.actionBtnSkeleton, { opacity: pulseAnim }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
    gap: 14,
  },
  card: {
    backgroundColor: colors.blanco,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.grisBorde,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(19, 46, 102, 0.12)',
  },
  infoCol: {
    flex: 1,
    gap: 6,
  },
  typeLine: {
    width: '38%',
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(19, 46, 102, 0.09)',
  },
  titleLine1: {
    width: '88%',
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(19, 46, 102, 0.13)',
  },
  titleLine2: {
    width: '58%',
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(19, 46, 102, 0.10)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  metaLine: {
    width: '45%',
    height: 13,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(19, 46, 102, 0.08)',
  },
  statusPill: {
    width: 86,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(46, 125, 91, 0.15)',
  },
  detailWrap: {
    paddingTop: spacing.xs,
    gap: spacing.md,
  },
  detailCard: {
    backgroundColor: colors.blanco,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.grisBorde,
    gap: 8,
  },
  urgencyBadge: {
    width: 110,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(244, 179, 66, 0.25)',
  },
  detailTitle1: {
    width: '92%',
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(19, 46, 102, 0.14)',
    marginTop: 4,
  },
  detailTitle2: {
    width: '64%',
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(19, 46, 102, 0.12)',
  },
  detailDesc1: {
    width: '100%',
    height: 13,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(19, 46, 102, 0.08)',
    marginTop: 8,
  },
  detailDesc2: {
    width: '78%',
    height: 13,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(19, 46, 102, 0.08)',
  },
  detailMeta: {
    marginTop: 12,
    gap: 6,
  },
  actionBtnSkeleton: {
    width: '100%',
    height: 52,
    borderRadius: radius.md,
    backgroundColor: 'rgba(19, 46, 102, 0.12)',
  },
});
