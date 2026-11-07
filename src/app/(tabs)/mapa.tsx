import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BarrioMap } from '@/components/BarrioMap';
import { Screen } from '@/components/Screen';
import { useFavors, useZones } from '@/hooks/useData';
import { usePalette } from '@/hooks/usePalette';
import { useAppStore } from '@/store/app-store';
import { CASTILLA_CENTER, type Coords } from '@/utils/geo';
import type { BarrioPoint } from '@/components/mapHtml';
import { colors, fonts, spacing } from '@/theme';

// Un favor "Ofrezco" es naranja; cualquier otro se muestra como "Pido ayuda" (azul).
function kindOf(title: string): 'pedir' | 'ofrecer' {
  return /^ofrezco/i.test(title) ? 'ofrecer' : 'pedir';
}

export default function MapaBarrio() {
  const p = usePalette();
  const zoneId = useAppStore((s) => s.zoneId);
  const { data: zonas = [] } = useZones();
  const { data: favores = [], isLoading, isError, refetch } = useFavors();

  const zona = zonas.find((z) => z.id === zoneId);
  const center: Coords =
    zona && zona.center_lat != null && zona.center_lng != null
      ? { lat: zona.center_lat, lng: zona.center_lng }
      : CASTILLA_CENTER;

  // Favores sin ubicación se dibujan en el centro de la zona.
  const points: BarrioPoint[] = favores
    .filter((f) => f.syncStatus === 'enviado')
    .map((f) => ({
      id: f.id,
      lat: f.location?.lat ?? center.lat,
      lng: f.location?.lng ?? center.lng,
      kind: kindOf(f.title),
      label: f.title.length > 48 ? `${f.title.slice(0, 48)}…` : f.title,
    }));

  const pedidos = points.filter((x) => x.kind === 'pedir').length;
  const ofrecidos = points.length - pedidos;

  return (
    <Screen scroll={false}>
      <Text style={[styles.titulo, { color: p.text }]}>Mapa del barrio</Text>
      <Text style={[styles.sub, { color: p.muted }]}>
        Cada punto es un favor publicado. Se actualiza solo cada pocos segundos.
      </Text>

      <View style={styles.resumen}>
        <View style={[styles.chip, { backgroundColor: colors.azulSuave }]}>
          <View style={[styles.dot, { backgroundColor: colors.azul }]} />
          <Text style={[styles.chipTexto, { color: colors.azul }]}>{pedidos} piden ayuda</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: colors.naranjaSuave }]}>
          <View style={[styles.dot, { backgroundColor: colors.naranja }]} />
          <Text style={[styles.chipTexto, { color: colors.azul }]}>{ofrecidos} ofrecen ayuda</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={p.primary} style={{ marginTop: spacing.xl }} />
      ) : isError ? (
        <View style={styles.aviso}>
          <Ionicons name="cloud-offline-outline" size={22} color={colors.azul} />
          <Text style={[styles.avisoTexto, { color: p.text }]} onPress={() => refetch()}>
            No pudimos cargar el mapa. Toca aquí para reintentar.
          </Text>
        </View>
      ) : (
        <BarrioMap
          center={center}
          points={points}
          onPointPress={(id) => router.push(`/favores/${id}`)}
          height={460}
        />
      )}

      <Text style={[styles.nota, { color: p.muted }]}>
        Las ubicaciones son aproximadas (unos 110 m) para proteger a los vecinos.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titulo: { fontFamily: fonts.bold, fontSize: 28, marginTop: spacing.xs },
  sub: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, marginTop: 4, marginBottom: spacing.md },
  resumen: { flexDirection: 'row', gap: 8, marginBottom: spacing.md, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  chipTexto: { fontFamily: fonts.semiBold, fontSize: 14 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md },
  avisoTexto: { fontFamily: fonts.semiBold, fontSize: 15, textDecorationLine: 'underline' },
  nota: { fontFamily: fonts.regular, fontSize: 13, marginTop: spacing.sm },
});
