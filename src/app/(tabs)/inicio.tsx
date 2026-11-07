import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FavorCard } from '@/components/FavorCard';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { usePalette } from '@/hooks/usePalette';
import { useFavors } from '@/hooks/useData';
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
  const offline = !useAppStore((s) => s.isOnline);
  const { data: favors = [] } = useFavors();

  const actions: Action[] = emergency
    ? [
        { label: 'Servicios', icon: 'medkit-outline', onPress: () => router.push('/emergencia') },
        { label: 'Reportes', icon: 'people-outline', onPress: () => router.push('/emergencia') },
        { label: 'Recursos', icon: 'water-outline', onPress: () => router.push('/emergencia') },
      ]
    : [
        { label: 'Buscar oficio', icon: 'search-outline', onPress: () => router.push('/(tabs)/oficios') },
        { label: 'Pedir favor', icon: 'hand-left-outline', onPress: () => router.push('/favores/nuevo') },
        { label: 'Ofrecer ayuda', icon: 'heart-outline', onPress: () => router.push('/favores/nuevo') },
      ];

  return (
    <Screen>
      <StatusBanner variant="emergencia" visible={emergency} />
      <StatusBanner variant="offline" visible={offline} />

      <View style={[styles.hero, { backgroundColor: p.primary }]}>
        <Text style={styles.heroKicker}>{emergency ? 'Modo emergencia' : 'Tu barrio hoy'}</Text>
        <Text style={styles.heroTitle}>Hola, {firstName || 'vecino'}</Text>
        <Text style={styles.heroText}>
          {emergency
            ? 'Revisa los apoyos disponibles cerca de ti.'
            : 'Encuentra ayuda o comparte lo que tienes.'}
        </Text>
        {emergency ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/favores/nuevo')}
            style={[styles.heroCta, { backgroundColor: p.cta }]}
          >
            <Text style={[styles.heroCtaText, { color: p.ctaText }]}>Publicar un favor</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.tiles}>
        {actions.map((a) => (
          <QuickAction key={a.label} {...a} />
        ))}
      </View>

      <Text style={[styles.seccion, { color: p.text }]}>Publicaciones recientes</Text>
      {favors.slice(0, 3).map((f) => (
        <FavorCard
          key={f.id}
          favor={f}
          onPress={f.syncStatus === 'enviado' ? () => router.push(`/favores/${f.id}`) : undefined}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, padding: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },
  heroKicker: { fontFamily: fonts.semibold, fontSize: 13, color: '#DCE4F5', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroTitle: { fontFamily: fonts.bold, fontSize: 28, color: colors.blanco, marginTop: 4 },
  heroText: { fontFamily: fonts.regular, fontSize: 17, color: '#E9EEF8', marginTop: 6, marginBottom: spacing.md },
  heroCta: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 12, minHeight: 48, justifyContent: 'center' },
  heroCtaText: { fontFamily: fonts.bold, fontSize: 16 },
  tiles: { flexDirection: 'row', gap: 10, marginBottom: spacing.sm },
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
  tileIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: fonts.semibold, fontSize: 14, textAlign: 'center' },
  seccion: { fontFamily: fonts.bold, fontSize: 22, marginTop: spacing.lg, marginBottom: spacing.sm },
});
