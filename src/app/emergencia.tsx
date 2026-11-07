import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import {
  useCreateResource,
  useReports,
  useResources,
  useServices,
} from '@/hooks/useData';
import { resourceLabel, serviceLabel } from '@/i18n/labels';
import type { ResourceKind, ResourceType } from '@/types';
import { colors, fonts, radius, spacing } from '@/theme';

const tiposRecurso = Object.keys(resourceLabel) as ResourceType[];

function llamar(phone: string) {
  Linking.openURL(`tel:${phone}`).catch(() =>
    Alert.alert('No se pudo llamar', `Marca manualmente: ${phone}`)
  );
}

function Estado({
  loading,
  error,
  vacio,
}: {
  loading: boolean;
  error: unknown;
  vacio: { title: string; message: string };
}) {
  const p = usePalette();
  if (loading) {
    return <ActivityIndicator color={p.primary} style={{ marginVertical: spacing.lg }} />;
  }
  if (error) {
    return <EmptyState title="No se pudo cargar" message={(error as Error).message} />;
  }
  return <EmptyState title={vacio.title} message={vacio.message} />;
}

export default function Emergencia() {
  const p = usePalette();
  const servicios = useServices();
  const reportes = useReports();
  const recursos = useResources();
  const crearRecurso = useCreateResource();

  const [tab, setTab] = useState<'servicios' | 'reportes' | 'recursos'>('servicios');
  const [modalVisible, setModalVisible] = useState(false);
  const [kind, setKind] = useState<ResourceKind>('oferta');
  const [resource, setResource] = useState<ResourceType>('agua');
  const [notes, setNotes] = useState('');

  const handleSaveResource = async () => {
    if (crearRecurso.isPending) return;
    try {
      await crearRecurso.mutateAsync({
        kind,
        resource,
        notes: notes.trim() ? notes.trim() : null,
      });
      setNotes('');
      setModalVisible(false);
    } catch (err) {
      Alert.alert(
        'No se pudo publicar el recurso',
        (err as Error)?.message ?? 'Inténtalo de nuevo.'
      );
    }
  };

  return (
    <Screen>
      {/* Banner superior de emergencia */}
      <View style={styles.emergencyBanner}>
        <Text style={styles.emergencyKicker}>RED DE AUXILIO VECINAL</Text>
        <Text style={styles.emergencyTitle}>Coordinación en Emergencia</Text>
        <Text style={styles.emergencySub}>
          Directorio verificado, alertas de vecinos vulnerables y recursos comunitarios en tu zona.
        </Text>
      </View>

      {/* Selector de pestañas del módulo de emergencia */}
      <View style={styles.tabsRow}>
        {(
          [
            { key: 'servicios', label: 'Servicios' },
            { key: 'reportes', label: `Reportes (${reportes.data?.length ?? 0})` },
            { key: 'recursos', label: `Recursos (${recursos.data?.length ?? 0})` },
          ] as const
        ).map((item) => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(item.key)}
              style={[
                styles.tabBtn,
                active ? { backgroundColor: p.primary } : styles.tabBtnInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: active ? colors.blanco : colors.azul },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'servicios' && (
        <View style={styles.sectionWrap}>
          <Text style={[styles.seccion, { color: p.text }]}>
            Entidades y servicios de auxilio
          </Text>
          {servicios.data?.length ? (
            servicios.data.map((s) => (
              <Card key={s.id}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.serviceTypeBadge}>{serviceLabel[s.type]}</Text>
                  {s.hours ? <Text style={styles.hoursText}>{s.hours}</Text> : null}
                </View>
                <Text style={[styles.nombre, { color: p.text }]}>{s.name}</Text>
                {s.addressSummary ? (
                  <Text style={styles.detalle}>{s.addressSummary}</Text>
                ) : null}
                {s.phone ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <AppButton
                      label={`Llamar al ${s.phone}`}
                      variant="secondary"
                      onPress={() => llamar(s.phone)}
                    />
                  </View>
                ) : null}
              </Card>
            ))
          ) : (
            <Estado
              loading={servicios.isLoading}
              error={servicios.error}
              vacio={{
                title: 'Sin servicios',
                message: 'Aún no hay servicios registrados para tu zona.',
              }}
            />
          )}
        </View>
      )}

      {tab === 'reportes' && (
        <View style={styles.sectionWrap}>
          <View style={{ marginBottom: spacing.md }}>
            <AppButton
              label="Reportar vecino en riesgo"
              variant="accent"
              onPress={() => router.push('/reportar')}
            />
          </View>

          <Text style={[styles.seccion, { color: p.text }]}>
            Alertas de vecinos vulnerables
          </Text>
          <Text style={[styles.detalle, { marginBottom: spacing.sm }]}>
            Ubicaciones redondeadas (~100m) para proteger la privacidad vecinal.
          </Text>

          {reportes.data?.length ? (
            reportes.data.map((r) => (
              <Card key={r.id}>
                <View style={styles.cardTopRow}>
                  <Text style={[styles.nombre, { color: p.text }]}>
                    {r.reporterName ? `Reportado por ${r.reporterName}` : 'Reporte vecinal anónimo'}
                  </Text>
                  <View style={styles.alertBadge}>
                    <Text style={styles.alertBadgeText}>Activo</Text>
                  </View>
                </View>

                <Text style={[styles.cuerpo, { color: p.body }]}>{r.description}</Text>

                {r.needs.length > 0 ? (
                  <View style={styles.needsRow}>
                    {r.needs.map((n) => (
                      <View key={n} style={styles.needPill}>
                        <Text style={styles.needPillText}>{resourceLabel[n]}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            ))
          ) : (
            <Estado
              loading={reportes.isLoading}
              error={reportes.error}
              vacio={{
                title: 'Sin reportes activos',
                message: 'Nadie ha reportado vecinos en riesgo en tu zona.',
              }}
            />
          )}
        </View>
      )}

      {tab === 'recursos' && (
        <View style={styles.sectionWrap}>
          <View style={{ marginBottom: spacing.md }}>
            <AppButton
              label="Publicar pedido u oferta de recurso"
              variant="accent"
              onPress={() => setModalVisible(true)}
            />
          </View>

          <Text style={[styles.seccion, { color: p.text }]}>
            Recursos críticos en tu zona
          </Text>

          {recursos.data?.length ? (
            recursos.data.map((r) => {
              const isOffer = r.kind === 'oferta';
              return (
                <Card key={r.id}>
                  <View style={styles.cardTopRow}>
                    <Text style={[styles.nombre, { color: p.text }]}>
                      {resourceLabel[r.resource]}
                    </Text>
                    <View
                      style={[
                        styles.resourceKindBadge,
                        isOffer ? styles.offerBadge : styles.requestBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.resourceKindText,
                          { color: isOffer ? colors.azul : colors.rojo },
                        ]}
                      >
                        {isOffer ? 'Vecino ofrece' : 'Se necesita'}
                      </Text>
                    </View>
                  </View>
                  {r.notes ? <Text style={styles.cuerpo}>{r.notes}</Text> : null}
                  {r.userName ? (
                    <Text style={[styles.detalle, { marginTop: 6 }]}>
                      Publicado por {r.userName}
                    </Text>
                  ) : null}
                </Card>
              );
            })
          ) : (
            <Estado
              loading={recursos.isLoading}
              error={recursos.error}
              vacio={{
                title: 'Sin recursos registrados',
                message: 'Todavía no hay pedidos ni ofertas de recursos en tu zona.',
              }}
            />
          )}
        </View>
      )}

      {/* Modal para publicar pedido u oferta de recurso crítico */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable
            onPress={() => {}}
            style={[styles.modalCard, { backgroundColor: colors.blanco }]}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: p.text }]}>
                Recurso de emergencia
              </Text>
              <Text style={styles.modalSub}>
                Indica si ofreces apoyo o si necesitas un recurso urgente en tu cuadra.
              </Text>

              <Text style={[styles.inputLabel, { color: p.text }]}>Modalidad</Text>
              <View style={styles.chipsWrap}>
                <Chip
                  label="Ofrezco a mis vecinos"
                  selected={kind === 'oferta'}
                  onPress={() => setKind('oferta')}
                />
                <Chip
                  label="Necesito con urgencia"
                  selected={kind === 'pedido'}
                  onPress={() => setKind('pedido')}
                />
              </View>

              <Text style={[styles.inputLabel, { color: p.text }]}>Tipo de recurso</Text>
              <View style={styles.chipsWrap}>
                {tiposRecurso.map((resType) => (
                  <Chip
                    key={resType}
                    label={resourceLabel[resType]}
                    selected={resource === resType}
                    onPress={() => setResource(resType)}
                  />
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: p.text }]}>
                Detalles y horario de coordinación
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Ej: Tengo bidones de agua limpia disponibles de 4pm a 7pm..."
                placeholderTextColor={colors.gris}
                multiline
                maxLength={280}
                style={[styles.modalInput, { borderColor: p.border, color: p.text }]}
              />

              <View style={{ marginTop: spacing.md, gap: 8 }}>
                <AppButton
                  label={crearRecurso.isPending ? 'Publicando...' : 'Publicar en mi zona'}
                  variant="accent"
                  onPress={handleSaveResource}
                  disabled={crearRecurso.isPending}
                />
                <AppButton
                  label="Cancelar"
                  variant="link"
                  onPress={() => setModalVisible(false)}
                />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  emergencyBanner: {
    backgroundColor: colors.rojo,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  emergencyKicker: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#FDE8E8',
    letterSpacing: 0.8,
  },
  emergencyTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.blanco,
    marginTop: 2,
  },
  emergencySub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#FEE2E2',
    marginTop: 4,
    lineHeight: 20,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  tabBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tabBtnInactive: {
    backgroundColor: colors.blanco,
    borderWidth: 1,
    borderColor: colors.grisBorde,
  },
  tabBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 13.5,
  },
  sectionWrap: {
    paddingBottom: spacing.lg,
  },
  seccion: {
    fontSize: 19,
    fontFamily: fonts.bold,
    marginBottom: spacing.xs,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  serviceTypeBadge: {
    fontFamily: fonts.semiBold,
    fontSize: 12.5,
    color: colors.azul,
  },
  hoursText: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    color: '#64748B',
  },
  nombre: {
    fontSize: 17,
    fontFamily: fonts.bold,
    marginBottom: 4,
    flex: 1,
  },
  cuerpo: {
    fontSize: 15,
    fontFamily: fonts.regular,
    lineHeight: 21,
    color: '#334155',
  },
  detalle: {
    fontSize: 13.5,
    fontFamily: fonts.regular,
    color: '#64748B',
  },
  alertBadge: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  alertBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 11.5,
    color: colors.rojo,
  },
  needsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  needPill: {
    backgroundColor: '#EEF5FD',
    borderColor: '#D0E3F8',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  needPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.azul,
  },
  resourceKindBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  offerBadge: {
    backgroundColor: '#EEF5FD',
    borderColor: '#D0E3F8',
  },
  requestBadge: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  resourceKindText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 46, 102, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 21,
    fontFamily: fonts.bold,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#64748B',
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    marginBottom: 8,
    marginTop: spacing.xs,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.xs,
  },
  modalInput: {
    minHeight: 84,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 15,
    fontFamily: fonts.regular,
    textAlignVertical: 'top',
  },
});
