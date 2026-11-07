import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useReports, useResources, useServices } from '@/hooks/useData';
import { resourceLabel, serviceLabel } from '@/i18n/labels';
import { fonts, spacing } from '@/theme';

export default function Emergencia() {
  const p = usePalette();
  const { data: servicios = [] } = useServices();
  const { data: reportes = [] } = useReports();
  const { data: recursos = [] } = useResources();

  return (
    <Screen>
      <Text style={[styles.seccion, { color: p.text }]}>Servicios de apoyo</Text>
      {servicios.length === 0 ? (
        <EmptyState title="Sin servicios" message="Aún no hay servicios registrados." />
      ) : (
        servicios.map((s) => (
          <Card key={s.id}>
            <Text style={[styles.nombre, { color: p.text }]}>{s.name}</Text>
            <Text style={{ color: p.muted, fontFamily: fonts.regular, fontSize: 15 }}>
              {`${serviceLabel[s.type]}${s.distanceKm !== undefined ? ` · ${s.distanceKm} km` : ''}`}
            </Text>
            <AppButton label={`Llamar ${s.phone}`} variant="secondary" onPress={() => {}} />
          </Card>
        ))
      )}

      <Text style={[styles.seccion, { color: p.text }]}>Reportes de vecinos</Text>
      <Text style={{ color: p.muted, fontFamily: fonts.regular, fontSize: 15, marginBottom: spacing.sm }}>Zonas aproximadas, sin direcciones exactas.</Text>
      {reportes.map((r) => (
        <Card key={r.id}>
          <Text style={[styles.nombre, { color: p.text }]}>{r.isAnonymous ? 'Vecino anónimo' : r.reporterName}</Text>
          <Text style={{ color: p.text, fontFamily: fonts.regular, fontSize: 16 }}>{r.description}</Text>
          <Text style={{ color: p.muted, fontFamily: fonts.regular, fontSize: 14 }}>{r.needs.map((n) => resourceLabel[n]).join(', ')}</Text>
        </Card>
      ))}

      <Text style={[styles.seccion, { color: p.text }]}>Recursos críticos</Text>
      {recursos.map((r) => (
        <Card key={r.id}>
          <View style={styles.fila}>
            <Text style={[styles.nombre, { color: p.text }]}>{resourceLabel[r.resource]}</Text>
            <Text style={{ color: p.muted, fontFamily: fonts.regular, fontSize: 15 }}>{r.kind === 'pedido' ? 'Se necesita' : 'Se ofrece'}</Text>
          </View>
          {r.notes ? <Text style={{ color: p.muted, fontFamily: fonts.regular, fontSize: 15 }}>{r.notes}</Text> : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  seccion: { fontSize: 22, fontFamily: fonts.bold, marginTop: spacing.md, marginBottom: spacing.sm },
  nombre: { fontSize: 18, fontFamily: fonts.bold, marginBottom: 2 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
