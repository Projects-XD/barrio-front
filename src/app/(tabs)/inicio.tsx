import { Ionicons } from '@expo/vector-icons';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { FavorCard } from '@/components/FavorCard';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBanner } from '@/components/StatusBanner';
import { usePalette } from '@/hooks/usePalette';
import { useFavors, useIsAdmin, useZones } from '@/hooks/useData';
import type { IconName } from '@/i18n/icons';
import { selectEmergencyActive, useAppStore } from '@/store/app-store';
import { colors, fonts, radius, shadow, spacing } from '@/theme';

const iconApp = require('../../../assets/brand/icon-app.png');

type Tile = { title: string; desc: string; icon: IconName; onPress: () => void; tone?: 'normal' | 'alerta' };

const EMERGENCY_PHONES = [
  { label: 'Policía', phone: '105' },
  { label: 'Bomberos', phone: '116' },
  { label: 'SAMU', phone: '106' },
];

function llamar(phone: string) {
  Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('No se pudo llamar', `Marca manualmente: ${phone}`));
}

function ActionTile({ title, desc, icon, onPress, tone = 'normal' }: Tile) {
  const p = usePalette();
  const alerta = tone === 'alerta';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${desc}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: alerta ? colors.rojoSuave : p.highlight }]}>
        <Ionicons name={icon} size={26} color={alerta ? colors.rojo : p.text} />
      </View>
      <Text style={[styles.tileTitle, { color: alerta ? colors.rojo : p.text }]}>{title}</Text>
      <Text style={[styles.tileDesc, { color: p.muted }]}>{desc}</Text>
    </Pressable>
  );
}

export default function Inicio() {
  const p = usePalette();
  const emergency = useAppStore(selectEmergencyActive);
  const offline = !useAppStore((s) => s.isOnline);
  const zoneId = useAppStore((s) => s.zoneId);
  const firstName = useAppStore((s) => s.userFullName)?.trim().split(' ')[0];
  const { data: zonas = [] } = useZones();
  const { data: favors = [], isLoading } = useFavors();
  const zona = zonas.find((z) => z.id === zoneId)?.name;
  const { data: isAdmin } = useIsAdmin();

  // Login, reapertura y el tab Inicio pasan todos por aquí. No se bloquea mientras carga el rol:
  // los vecinos no deben esperar a /admin/me para ver su inicio.
  if (isAdmin) return <Redirect href="/admin" />;

  const tiles: Tile[] = emergency
    ? [
        { title: 'Servicios', desc: 'Salud, bomberos y policía', icon: 'medkit-outline', onPress: () => router.push('/emergencia') },
        { title: 'Reportar vecino', desc: 'Alguien necesita ayuda', icon: 'people-outline', onPress: () => router.push('/reportar'), tone: 'alerta' },
        { title: 'Recursos', desc: 'Agua, medicinas, transporte', icon: 'water-outline', onPress: () => router.push('/emergencia') },
        { title: 'Ofrecer ayuda', desc: 'Comparte lo que tienes', icon: 'heart-outline', onPress: () => router.push('/favores/nuevo') },
      ]
    : [
        { title: 'Buscar un oficio', desc: 'Gasfiteros, electricistas y más', icon: 'search-outline', onPress: () => router.push('/(tabs)/oficios') },
        { title: 'Pedir un favor', desc: 'Herramientas, ayuda o traslado', icon: 'hand-left-outline', onPress: () => router.push('/favores/nuevo') },
        { title: 'Ofrecer ayuda', desc: 'Comparte lo que sabes o tienes', icon: 'heart-outline', onPress: () => router.push('/favores/nuevo') },
        { title: 'Emergencia', desc: 'Servicios y reportes', icon: 'alert-circle-outline', onPress: () => router.push('/emergencia'), tone: 'alerta' },
      ];

  return (
    <Screen>
      <View style={styles.header}>
        <Image source={iconApp} style={styles.logo} accessibilityLabel="Barrio" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.hola, { color: p.text }]}>Hola, {firstName || 'vecino'}</Text>
          {zona ? (
            <View style={styles.zonaRow}>
              <Ionicons name="location-outline" size={15} color={p.muted} />
              <Text style={[styles.zona, { color: p.muted }]}>{zona}, Piura</Text>
            </View>
          ) : null}
        </View>
      </View>

      <StatusBanner variant="offline" visible={offline} />

      {emergency ? (
        <View style={[styles.hero, { backgroundColor: colors.rojo }]}>
          <View style={[styles.heroBlob, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
          <Text style={[styles.heroKicker, { color: '#FFE3DC' }]}>Modo emergencia</Text>
          <Text style={styles.heroTitle}>Tu zona necesita apoyo</Text>
          <Text style={styles.heroText}>Si es urgente, llama directo:</Text>
          <View style={styles.callRow}>
            {EMERGENCY_PHONES.map((e) => (
              <Pressable
                key={e.phone}
                accessibilityRole="button"
                accessibilityLabel={`Llamar a ${e.label}, ${e.phone}`}
                onPress={() => llamar(e.phone)}
                style={({ pressed }) => [styles.callPill, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="call" size={16} color={colors.rojo} />
                <Text style={styles.callText}>{e.phone}</Text>
                <Text style={styles.callLabel}>{e.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View style={[styles.hero, { backgroundColor: colors.azul }]}>
          <View style={[styles.heroBlob, { backgroundColor: colors.azulMedio }]} />
          <Text style={[styles.heroKicker, { color: colors.naranjaSuave }]}>Tu barrio hoy</Text>
          <Text style={styles.heroTitle}>¿En qué te ayudamos hoy?</Text>
          <Text style={styles.heroText}>Pide o comparte un favor con tus vecinos, sin dinero de por medio.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/favores/nuevo')}
            style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="add-circle" size={22} color={colors.azul} />
            <Text style={styles.heroCtaText}>Publicar un favor</Text>
          </Pressable>
        </View>
      )}

      <SectionHeader title="¿Qué necesitas?" />
      <View style={styles.grid}>
        {tiles.map((t) => (
          <ActionTile key={t.title} {...t} />
        ))}
      </View>

      <SectionHeader
        title="Favores recientes"
        actionLabel={favors.length ? 'Ver todos' : undefined}
        onAction={() => router.push('/(tabs)/favores')}
      />
      {favors.length ? (
        favors.slice(0, 3).map((f) => (
          <FavorCard
            key={f.id}
            favor={f}
            onPress={f.syncStatus === 'enviado' ? () => router.push(`/favores/${f.id}`) : undefined}
          />
        ))
      ) : isLoading ? null : (
        <EmptyState
          icon="heart-outline"
          title="Aún no hay favores en tu zona"
          message="Sé el primero: pide una mano o ofrece algo que puedas compartir."
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md },
  logo: { width: 48, height: 48, borderRadius: 14 },
  hola: { fontFamily: fonts.bold, fontSize: 26 },
  zonaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  zona: { fontFamily: fonts.medium, fontSize: 15 },

  hero: { borderRadius: radius.xl, padding: spacing.lg, overflow: 'hidden', ...shadow },
  heroBlob: { position: 'absolute', width: 150, height: 150, borderRadius: 75, right: -55, top: -65 },
  heroKicker: { fontFamily: fonts.semiBold, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroTitle: { fontFamily: fonts.bold, fontSize: 26, color: colors.blanco, marginTop: 6, lineHeight: 32 },
  heroText: { fontFamily: fonts.regular, fontSize: 16, color: '#E7ECF7', marginTop: 8, lineHeight: 22 },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: colors.naranja,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    minHeight: 50,
    marginTop: spacing.md,
  },
  heroCtaText: { fontFamily: fonts.bold, fontSize: 16, color: colors.azul },

  callRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  callPill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.blanco,
    borderRadius: radius.md,
    paddingVertical: 10,
    minHeight: 64,
    justifyContent: 'center',
  },
  callText: { fontFamily: fonts.bold, fontSize: 18, color: colors.rojo, marginTop: 2 },
  callLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.texto },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  tile: {
    width: '48.5%',
    backgroundColor: colors.blanco,
    borderRadius: radius.lg,
    padding: 16,
    minHeight: 150,
    ...shadow,
  },
  tileIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  tileTitle: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  tileDesc: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, marginTop: 4 },
});
