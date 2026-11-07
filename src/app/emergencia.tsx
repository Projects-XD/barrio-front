import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useReports, useResources, useServices } from '@/hooks/useData';
import { resourceLabel, serviceLabel } from '@/i18n/labels';
import { fonts, spacing } from '@/theme';

function llamar(phone: string) {
  Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('No se pudo llamar', `Marca manualmente: ${phone}`));
}

function Estado({ loading, error, vacio }: { loading: boolean; error: unknown; vacio: { title: string; message: string } }) {
  const p = usePalette();
  if (loading) return <ActivityIndicator color={p.primary} style={{ marginVertical: spacing.md }} />;
  if (error) return <EmptyState title="No se pudo cargar" message={(error as Error).message} />;
  return <EmptyState title={vacio.title} message={vacio.message} />;
}

export default function Emergencia() {
  const p = usePalette();
  const servicios = useServices();
  const reportes = useReports();
  const recursos = useResources();

  return (
    <Screen>
      <AppButton label="Reportar vecino en riesgo" variant="primary" onPress={() => router.push('/reportar')} />

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
          vacio={{ title: 'Sin servicios', message: 'Aún no hay servicios registrados para tu zona.' }}
        />
      )}

      <Text style={[styles.seccion, { color: p.text }]}>Reportes de vecinos</Text>
      <Text style={[styles.detalle, { color: p.muted, marginBottom: spacing.sm }]}>
        Zonas aproximadas, sin direcciones exactas.
      </Text>
      {reportes.data?.length ? (
        reportes.data.map((r) => (
          <Card key={r.id}>
            <Text style={[styles.nombre, { color: p.text }]}>{r.reporterName ?? 'Vecino anónimo'}</Text>
            <Text style={[styles.cuerpo, { color: p.body }]}>{r.description}</Text>
            {r.needs.length ? (
              <Text style={[styles.detalle, { color: p.muted }]}>
                Necesita: {r.needs.map((n) => resourceLabel[n]).join(', ')}
              </Text>
            ) : null}
          </Card>
        ))
      ) : (
        <Estado
          loading={reportes.isLoading}
          error={reportes.error}
          vacio={{ title: 'Sin reportes', message: 'Nadie ha reportado vecinos en riesgo en tu zona.' }}
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
          vacio={{ title: 'Sin recursos', message: 'Todavía no hay pedidos ni ofertas de recursos.' }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  seccion: { fontSize: 22, fontFamily: fonts.bold, marginTop: spacing.md, marginBottom: spacing.sm },
  nombre: { fontSize: 18, fontFamily: fonts.bold, marginBottom: 2 },
  cuerpo: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22 },
  detalle: { fontSize: 15, fontFamily: fonts.regular },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
