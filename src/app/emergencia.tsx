import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useReports, useResources, useServices } from '@/hooks/useData';
import type { IconName } from '@/i18n/icons';
import { resourceLabel, serviceLabel } from '@/i18n/labels';
import { selectEmergencyActive, useAppStore } from '@/store/app-store';
import { colors, fonts, radius, spacing } from '@/theme';
import type { VulnerabilityReport } from '@/types';
import { shareReportWhatsApp } from '@/utils/share';

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
  const reportes = useReports();
  const recursos = useResources();
  const [menuReporte, setMenuReporte] = useState<VulnerabilityReport | null>(null);

  return (
    <Screen>
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
        Zonas aproximadas, sin direcciones exactas (~110 m de privacidad).
      </Text>
      {reportes.data?.length ? (
        reportes.data.map((r) => (
          <Card key={r.id}>
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
            {r.needs.length ? (
              <Text style={[styles.detalle, { color: p.muted, marginTop: 4 }]}>
                Necesita: {r.needs.map((n) => resourceLabel[n]).join(', ')}
              </Text>
            ) : null}
          </Card>
        ))
      ) : (
        <Estado
          loading={reportes.isLoading}
          error={reportes.error}
          vacio={{ icon: 'people-outline', title: 'Sin reportes', message: 'Nadie ha reportado vecinos en riesgo en tu zona.' }}
        />
      )}

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

      <Modal visible={menuReporte !== null} transparent animationType="fade" onRequestClose={() => setMenuReporte(null)}>
        <Pressable style={styles.overlay} onPress={() => setMenuReporte(null)}>
          <Pressable onPress={() => {}} style={styles.menuCard}>
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
            <AppButton label="Cancelar" variant="secondary" onPress={() => setMenuReporte(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const iconEmergencia = require('../../assets/brand/icon-emergencia.png');

const styles = StyleSheet.create({
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md },
  iconoEmergencia: { width: 64, height: 64, borderRadius: 14 },
  seccion: { fontSize: 22, fontFamily: fonts.bold, marginTop: spacing.md, marginBottom: spacing.sm },
  nombre: { fontSize: 18, fontFamily: fonts.bold, marginBottom: 2 },
  cuerpo: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22 },
  detalle: { fontSize: 15, fontFamily: fonts.regular },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
