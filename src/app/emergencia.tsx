import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useAttendReport, useInfiniteReports, useReleaseReport, useRequestBackup, useResolveReport, useResources, useServices } from '@/hooks/useData';
import type { IconName } from '@/i18n/icons';
import { resourceLabel, serviceLabel } from '@/i18n/labels';
import { selectEmergencyActive, useAppStore } from '@/store/app-store';
import { colors, fonts, radius, spacing } from '@/theme';
import type { VulnerabilityReport } from '@/types';
import { shareReportWhatsApp } from '@/utils/share';
import { AppModal } from '@/components/AppModal';

// Números nacionales de emergencia (Perú), también citados en la pantalla de reporte.
const NUMEROS_EMERGENCIA = [
  { phone: '106', label: 'SAMU (106)', icon: 'medkit-outline' as IconName },
  { phone: '116', label: 'Bomberos (116)', icon: 'flame-outline' as IconName },
  { phone: '105', label: 'Policía (105)', icon: 'shield-outline' as IconName },
];

// Abre el punto en el mapa del teléfono: usa las coordenadas aproximadas si hay, si no, la dirección escrita.
function abrirEnMapa(r: VulnerabilityReport) {
  const query = r.approxLat && r.approxLng ? `${r.approxLat},${r.approxLng}` : (r.locationDetail ?? '');
  if (!query) return;
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`).catch(() =>
    Alert.alert('No se pudo abrir el mapa', 'Busca la dirección manualmente.')
  );
}

function llamar(phone: string) {
  Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('No se pudo llamar', `Marca manualmente: ${phone}`));
}

function Estado({
  loading,
  error,
  vacio,
}: {
  loading: boolean;
  error: unknown;
  vacio: { title: string; message: string; icon: IconName };
}) {
  const p = usePalette();
  if (loading) return <ActivityIndicator color={p.primary} style={{ marginVertical: spacing.md }} />;
  if (error) return <EmptyState icon="cloud-offline-outline" title="No se pudo cargar" message={(error as Error).message} />;
  return <EmptyState icon={vacio.icon} title={vacio.title} message={vacio.message} />;
}

export default function Emergencia() {
  const p = usePalette();
  const emergencyActive = useAppStore(selectEmergencyActive);
  const emergencyReason = useAppStore((s) => s.emergencyReason);
  const servicios = useServices();
  const reportes = useInfiniteReports();
  const resolver = useResolveReport();
  const atender = useAttendReport();
  const soltar = useReleaseReport();
  const refuerzo = useRequestBackup();
  // Reporte al que otro vecino ya acude: se confirma antes de sumarse.
  const [confirmarUnirse, setConfirmarUnirse] = useState<VulnerabilityReport | null>(null);
  const userId = useAppStore((s) => s.userId);
  const recursos = useResources();
  const [menuReporte, setMenuReporte] = useState<VulnerabilityReport | null>(null);
  const items = reportes.data?.items ?? [];
  const total = reportes.data?.total ?? 0;
  const canResolve = reportes.data?.canResolve ?? false;

  const unirse = (id: string) =>
    atender.mutate(id, {
      onError: (e) => Alert.alert('No se pudo sumar al reporte', (e as Error).message),
    });

  const cabecera = (
    <>
      <View style={styles.cabecera}>
        <Image source={iconEmergencia} style={styles.iconoEmergencia} accessibilityLabel="Modo emergencia de Barrio" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.seccion, { color: p.text, marginTop: 0, marginBottom: 2 }]}>Ayuda cerca de ti</Text>
          <Text style={{ color: p.muted, fontFamily: fonts.regular, fontSize: 15 }}>
            {emergencyActive && emergencyReason
              ? `Alerta activa: ${emergencyReason}`
              : 'Vecinos y servicios de auxilio en tu zona.'}
          </Text>
        </View>
      </View>

      <AppButton
        label="Reportar vecino en riesgo"
        variant="danger"
        icon="alert-circle-outline"
        onPress={() => router.push('/reportar')}
      />

      <Text style={[styles.seccion, { color: p.text }]}>Servicios de apoyo</Text>
      {servicios.data?.length ? (
        servicios.data.map((s) => (
          <Card key={s.id}>
            <Text style={[styles.nombre, { color: p.text }]}>{s.name}</Text>
            <Text style={[styles.detalle, { color: p.muted }]}>
              {[serviceLabel[s.type], s.hours].filter(Boolean).join(' · ')}
            </Text>
            {s.phone ? (
              <AppButton label={`Llamar al ${s.phone}`} variant="secondary" onPress={() => llamar(s.phone)} />
            ) : null}
          </Card>
        ))
      ) : (
        <Estado
          loading={servicios.isLoading}
          error={servicios.error}
          vacio={{ icon: 'medkit-outline', title: 'Sin servicios', message: 'Aún no hay servicios registrados para tu zona.' }}
        />
      )}

      <Text style={[styles.seccion, { color: p.text }]}>Reportes de vecinos</Text>
      <Text style={[styles.detalle, { color: p.muted, marginBottom: spacing.sm }]}>
        Zonas aproximadas, sin direcciones exactas (~110 m de privacidad). Se archivan solos a las 6 horas.
      </Text>
      {total > 0 ? (
        <Text style={[styles.contador, { color: p.text }]}>
          Mostrando {items.length} de {total} reportes activos
        </Text>
      ) : null}
    </>
  );

  const pie = (
    <>
      {reportes.isFetchingNextPage ? (
        <ActivityIndicator color={p.primary} style={{ marginVertical: spacing.md }} />
      ) : null}

      <Text style={[styles.seccion, { color: p.text }]}>Recursos críticos</Text>
      {recursos.data?.length ? (
        recursos.data.map((r) => (
          <Card key={r.id}>
            <View style={styles.fila}>
              <Text style={[styles.nombre, { color: p.text }]}>{resourceLabel[r.resource]}</Text>
              <Text style={[styles.detalle, { color: p.muted }]}>
                {r.kind === 'pedido' ? 'Se necesita' : 'Se ofrece'}
              </Text>
            </View>
            {r.notes ? <Text style={[styles.detalle, { color: p.muted }]}>{r.notes}</Text> : null}
          </Card>
        ))
      ) : (
        <Estado
          loading={recursos.isLoading}
          error={recursos.error}
          vacio={{ icon: 'water-outline', title: 'Sin recursos', message: 'Todavía no hay pedidos ni ofertas de recursos.' }}
        />
      )}
    </>
  );

  return (
    <Screen scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={cabecera}
        ListFooterComponent={pie}
        ListEmptyComponent={
          <Estado
            loading={reportes.isLoading}
            error={reportes.error}
            vacio={{ icon: 'people-outline', title: 'Sin reportes', message: 'Nadie ha reportado vecinos en riesgo en tu zona.' }}
          />
        }
        onEndReached={() => {
          if (reportes.hasNextPage && !reportes.isFetchingNextPage) void reportes.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        renderItem={({ item: r }) => (
          <Card>
            <View style={styles.reporteHeader}>
              <Text style={[styles.nombre, { color: p.text, flex: 1 }]}>{r.reporterName ?? 'Vecino anónimo'}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Opciones del reporte"
                hitSlop={10}
                onPress={() => setMenuReporte(r)}
                style={styles.menuBtn}
              >
                <Ionicons name="ellipsis-vertical" size={18} color={colors.azul} />
              </Pressable>
            </View>
            <Text style={[styles.cuerpo, { color: p.body }]}>{r.description}</Text>
            {r.affectedName ? (
              <Text style={[styles.cuerpo, { color: p.text, marginTop: 4 }]}>
                <Text style={{ fontFamily: fonts.semiBold }}>Vecino: </Text>
                {r.affectedName}
              </Text>
            ) : null}
            {r.locationDetail ? (
              <Text style={[styles.cuerpo, { color: p.text, marginTop: 4 }]}>
                <Text style={{ fontFamily: fonts.semiBold }}>Dónde: </Text>
                {r.locationDetail}
              </Text>
            ) : null}
            {r.detailHidden ? (
              <Text style={[styles.detalle, { color: p.muted, marginTop: 4 }]}>
                Toca «Voy a ayudar» para ver el nombre y la dirección exacta.
              </Text>
            ) : null}
            {r.locationDetail || (!r.detailHidden && r.approxLat && r.approxLng) ? (
              <AppButton label="Abrir en el mapa" variant="secondary" icon="map-outline" onPress={() => abrirEnMapa(r)} />
            ) : null}
            {r.needs.length ? (
              <Text style={[styles.detalle, { color: p.muted, marginTop: 4 }]}>
                Necesita: {r.needs.map((n) => resourceLabel[n]).join(', ')}
              </Text>
            ) : null}
            {r.responders.length ? (
              <View style={styles.atendiendo}>
                <Ionicons name="shield-checkmark" size={18} color={colors.verdeExito} />
                <Text style={[styles.detalle, { color: p.text, flex: 1 }]}>
                  {r.responders.length === 1 ? '1 vecino acude' : `${r.responders.length} vecinos acuden`}:{' '}
                  {r.responders.map((x) => (x.id === userId ? 'Tú' : x.name)).join(', ')}
                </Text>
              </View>
            ) : r.escalatedAt ? (
              <View style={styles.escalado}>
                <Ionicons name="warning" size={18} color={colors.rojo} />
                <Text style={[styles.detalle, { color: colors.rojo, fontFamily: fonts.semiBold, flex: 1 }]}>
                  Sin atender hace más de 15 min. Si es grave, llama a emergencias.
                </Text>
              </View>
            ) : null}
            {r.isMine ? null : r.responders.some((x) => x.id === userId) ? (
              <>
                <AppButton
                  label={refuerzo.isPending && refuerzo.variables === r.id ? 'Avisando…' : 'Necesito más ayuda'}
                  variant="danger"
                  icon="people-outline"
                  disabled={refuerzo.isPending}
                  onPress={() =>
                    refuerzo.mutate(r.id, {
                      onSuccess: () => Alert.alert('Aviso enviado', 'Se avisó a los vecinos de tu zona que necesitas más ayuda.'),
                      onError: (e) => Alert.alert('No se pudo pedir ayuda', (e as Error).message),
                    })
                  }
                />
                <AppButton
                  label="Ya no puedo ir"
                  variant="secondary"
                  disabled={soltar.isPending}
                  onPress={() =>
                    soltar.mutate(r.id, {
                      onError: (e) => Alert.alert('No se pudo salir del reporte', (e as Error).message),
                    })
                  }
                />
              </>
            ) : (
              <>
                <AppButton
                  label={atender.isPending && atender.variables === r.id ? 'Sumándote…' : 'Voy a ayudar'}
                  variant="primary"
                  icon="hand-left-outline"
                  disabled={atender.isPending}
                  onPress={() => (r.responders.length ? setConfirmarUnirse(r) : unirse(r.id))}
                />
                {!r.responders.length && r.escalatedAt ? (
                  <AppButton label="Llamar al SAMU (106)" variant="danger" icon="call-outline" onPress={() => llamar('106')} />
                ) : null}
              </>
            )}
            {canResolve || r.isMine ? (
              <AppButton
                label={resolver.isPending && resolver.variables === r.id ? 'Resolviendo…' : 'Marcar como resuelto'}
                variant="success"
                icon="checkmark-circle-outline"
                disabled={resolver.isPending}
                onPress={() =>
                  resolver.mutate(r.id, {
                    onError: (e) => Alert.alert('No se pudo resolver', (e as Error).message),
                  })
                }
              />
            ) : null}
          </Card>
        )}
      />

      <AppModal
        visible={confirmarUnirse !== null}
        onClose={() => setConfirmarUnirse(null)}
        animationType="fade"
        overlayStyle={styles.overlay}
        cardStyle={styles.menuCard}
      >
        <Text style={[styles.nombre, { color: p.text, marginBottom: spacing.xs }]}>Ya hay ayuda en camino</Text>
        <Text style={[styles.cuerpo, { color: p.body, marginBottom: spacing.sm }]}>
          {confirmarUnirse
            ? `${confirmarUnirse.responders.length === 1 ? 'Ya hay 1 vecino acudiendo' : `Ya hay ${confirmarUnirse.responders.length} vecinos acudiendo`} (${confirmarUnirse.responders.map((x) => x.name).join(', ')}). ¿Quieres ir también?`
            : ''}
        </Text>
        <AppButton
          label="Sí, voy también"
          variant="primary"
          onPress={() => {
            const target = confirmarUnirse;
            setConfirmarUnirse(null);
            if (target) unirse(target.id);
          }}
        />
        <AppButton label="No por ahora" variant="secondary" onPress={() => setConfirmarUnirse(null)} />
      </AppModal>

      <AppModal visible={menuReporte !== null} onClose={() => setMenuReporte(null)} animationType="fade" overlayStyle={styles.overlay} cardStyle={styles.menuCard}>
                    <Text style={[styles.nombre, { color: p.text, marginBottom: spacing.xs }]}>Opciones del reporte</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const target = menuReporte;
                setMenuReporte(null);
                if (target) shareReportWhatsApp(target);
              }}
              style={styles.menuRow}
            >
              <Ionicons name="logo-whatsapp" size={20} color={colors.azul} />
              <Text style={[styles.menuRowText, { color: p.text }]}>Difundir en WhatsApp del barrio</Text>
            </Pressable>
            {NUMEROS_EMERGENCIA.map((n) => (
              <Pressable
                key={n.phone}
                accessibilityRole="button"
                onPress={() => {
                  setMenuReporte(null);
                  llamar(n.phone);
                }}
                style={styles.menuRow}
              >
                <Ionicons name={n.icon} size={20} color={colors.rojo} />
                <Text style={[styles.menuRowText, { color: p.text }]}>Llamar a {n.label}</Text>
              </Pressable>
            ))}
            <AppButton label="Cancelar" variant="secondary" onPress={() => setMenuReporte(null)} />
      </AppModal>
    </Screen>
  );
}

const iconEmergencia = require('../../assets/brand/icon-emergencia.png');

const styles = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md },
  iconoEmergencia: { width: 64, height: 64, borderRadius: 14 },
  seccion: { fontSize: 22, fontFamily: fonts.section, marginTop: spacing.md, marginBottom: spacing.sm },
  nombre: { fontSize: 18, fontFamily: fonts.bold, marginBottom: 2 },
  cuerpo: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22 },
  detalle: { fontSize: 15, fontFamily: fonts.regular },
  contador: { fontSize: 14, fontFamily: fonts.semiBold, marginBottom: spacing.sm },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  atendiendo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  escalado: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  reporteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fondo,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(19, 46, 102, 0.5)', justifyContent: 'center', padding: spacing.lg },
  menuCard: { backgroundColor: colors.blanco, borderRadius: radius.xl, padding: spacing.lg, width: '100%', maxWidth: 400, alignSelf: 'center' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 6 },
  menuRowText: { fontFamily: fonts.semiBold, fontSize: 15 },
});
