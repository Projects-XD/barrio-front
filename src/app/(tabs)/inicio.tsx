import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { FavorCard } from '@/components/FavorCard';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { usePalette } from '@/hooks/usePalette';
import { useFavors, useProfiles } from '@/hooks/useData';
import type { IconName } from '@/i18n/icons';
import { selectEmergencyActive, useAppStore } from '@/store/app-store';
import { colors, fonts, radius, spacing } from '@/theme';

type Action = { label: string; icon: IconName; onPress: () => void };

function QuickAction({ label, icon, onPress }: Action) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { borderColor: p.border, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: p.primary }]}>
        <Ionicons name={icon} size={22} color={colors.blanco} />
      </View>
      <Text style={[styles.tileLabel, { color: p.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function Inicio() {
  const p = usePalette();
  const emergency = useAppStore(selectEmergencyActive);
  const firstName = useAppStore((s) => s.userFullName)?.trim().split(' ')[0];
  const zoneName = useAppStore((s) => s.zoneName) || 'Castilla';
  const offline = !useAppStore((s) => s.isOnline);
  const { data: favors = [] } = useFavors();
  const { data: profiles = [] } = useProfiles();

  const actions: Action[] = emergency
    ? [
        { label: 'Servicios', icon: 'medkit-outline', onPress: () => router.push('/emergencia') },
        { label: 'Reportar riesgo', icon: 'alert-circle-outline', onPress: () => router.push('/reportar') },
        { label: 'Recursos', icon: 'water-outline', onPress: () => router.push('/emergencia') },
      ]
    : [
        { label: 'Buscar oficio', icon: 'search-outline', onPress: () => router.push('/(tabs)/oficios') },
        { label: 'Pedir favor', icon: 'hand-left-outline', onPress: () => router.push('/favores/nuevo') },
        { label: 'Muro solidario', icon: 'heart-outline', onPress: () => router.push('/(tabs)/favores') },
      ];

  return (
    <Screen>
      <StatusBanner variant="emergencia" visible={emergency} />
      <StatusBanner variant="offline" visible={offline} />

      <View style={[styles.hero, { backgroundColor: p.primary }]}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroKicker}>{emergency ? 'Modo emergencia' : 'Tu barrio hoy'}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/perfil')}
            style={styles.zonePill}
          >
            <Ionicons name="location-outline" size={13} color={colors.blanco} />
            <Text style={styles.zonePillText}>{zoneName}</Text>
          </Pressable>
        </View>

        <Text style={styles.heroTitle}>Hola, {firstName || 'vecino'}</Text>
        <Text style={styles.heroText}>
          {emergency
            ? 'Coordina apoyo inmediato, recursos críticos y reportes en tu zona.'
            : 'Encuentra oficios validados por tus vecinos o comparte ayuda mutua.'}
        </Text>

        <View style={styles.heroActionsRow}>
          {emergency ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/emergencia')}
              style={[styles.heroCta, { backgroundColor: colors.blanco }]}
            >
              <Text style={[styles.heroCtaText, { color: colors.rojo }]}>
                Ir al panel de emergencia
              </Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/favores/nuevo')}
              style={[styles.heroCta, { backgroundColor: p.cta }]}
            >
              <Text style={[styles.heroCtaText, { color: p.ctaText }]}>Publicar un favor</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.tiles}>
        {actions.map((a) => (
          <QuickAction key={a.label} {...a} />
        ))}
      </View>

      {/* Sección Favores Recientes */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.seccion, { color: p.text }]}>Favores recientes</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/favores')}
          style={styles.seeAllBtn}
        >
          <Text style={[styles.seeAllText, { color: p.primary }]}>Ver todos</Text>
          <Ionicons name="arrow-forward" size={15} color={p.primary} />
        </Pressable>
      </View>

      {favors.length > 0 ? (
        favors.slice(0, 3).map((f) => (
          <FavorCard
            key={f.id}
            favor={f}
            onPress={() => router.push(`/favores/${f.id}`)}
          />
        ))
      ) : (
        <EmptyState
          title="Aún no hay favores activos"
          message="Publica el primer favor comunitario en tu zona."
        />
      )}

      {/* Sección Oficios Destacados */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.seccion, { color: p.text }]}>Oficios recomendados</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/oficios')}
          style={styles.seeAllBtn}
        >
          <Text style={[styles.seeAllText, { color: p.primary }]}>Ver directorio</Text>
          <Ionicons name="arrow-forward" size={15} color={p.primary} />
        </Pressable>
      </View>

      {profiles.length > 0 ? (
        profiles.slice(0, 2).map((prof) => (
          <ProfessionalCard
            key={prof.id}
            profile={prof}
            onPress={() => router.push(`/oficio/${prof.id}`)}
          />
        ))
      ) : (
        <EmptyState
          title="Directorio de oficios"
          message="Explora los técnicos y especialistas recomendados por tus vecinos."
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 20,
    padding: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroKicker: {
    fontFamily: fonts.semiBold,
    fontSize: 12.5,
    color: '#DCE4F5',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  zonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  zonePillText: {
    fontFamily: fonts.semiBold,
    fontSize: 12.5,
    color: colors.blanco,
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.blanco,
    marginTop: 6,
  },
  heroText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: '#E9EEF8',
    lineHeight: 22,
    marginTop: 6,
    marginBottom: spacing.md,
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCta: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  heroCtaText: {
    fontFamily: fonts.bold,
    fontSize: 15.5,
  },
  tiles: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.xs,
  },
  tile: {
    flex: 1,
    backgroundColor: colors.blanco,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    minHeight: 96,
    justifyContent: 'center',
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13.5,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  seccion: {
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  seeAllText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
});
