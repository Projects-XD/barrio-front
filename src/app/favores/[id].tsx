import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { SkeletonFavorDetalle } from '@/components/SkeletonFavores';
import { StatusBanner } from '@/components/StatusBanner';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import { usePalette } from '@/hooks/usePalette';
import {
  useConversations,
  useDeleteFavor,
  useExpressInterest,
  useFavor,
  useReportFavor,
  useUpdateFavor,
} from '@/hooks/useData';
import { favorStatusLabel, favorTypeBackground, favorTypeLabel } from '@/i18n/labels';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, radius, spacing } from '@/theme';
import type { FavorType } from '@/types';
import { timeAgo } from '@/utils/time';

const tipos = Object.keys(favorTypeLabel) as FavorType[];

const MOTIVOS_REPORTE = [
  { label: 'Es broma o spam', reason: 'Broma o spam' },
  { label: 'No es una ayuda real', reason: 'No es una ayuda real' },
  { label: 'Contenido ofensivo', reason: 'Contenido ofensivo' },
] as const;

export default function FavorDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const userId = useAppStore((s) => s.userId);
  const { data: favor, isLoading, isError, error, refetch } = useFavor(id);
  const interes = useExpressInterest(id);
  const actualizar = useUpdateFavor(id);
  const eliminar = useDeleteFavor(id);
  const reportar = useReportFavor(id);
  const conversaciones = useConversations(id);

  const [editando, setEditando] = useState(false);
  const [tipo, setTipo] = useState<FavorType>('otros');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [reportando, setReportando] = useState(false);
  const [reporteEnviado, setReporteEnviado] = useState<{ hidden: boolean } | null>(null);

  const abrirReporte = () => {
    reportar.reset();
    setReporteEnviado(null);
    setReportando(true);
  };

  const enviarReporte = (reason: string) => {
    reportar.mutate(reason, {
      onSuccess: (res) => {
        setReporteEnviado(res);
      },
    });
  };

  if (isLoading) {
    return (
      <Screen>
        <SkeletonFavorDetalle />
      </Screen>
    );
  }

  if (isError || !favor) {
    return (
      <Screen>
        <EmptyState
          title="No pudimos abrir este favor"
          message={(error as Error)?.message ?? 'Puede que ya no esté disponible.'}
        />
        <AppButton label="Reintentar" variant="secondary" onPress={() => refetch()} />
      </Screen>
    );
  }

  const esMio = favor.authorId === userId;
  const abierto = favor.status === 'abierta' || favor.status === 'en_curso';

  const abrirEdicion = () => {
    actualizar.reset();
    setTipo(favor.type);
    setTitulo(favor.title);
    setDescripcion(favor.description ?? '');
    setEditando(true);
  };

  const guardarEdicion = () => {
    actualizar.mutate(
      { type: tipo, title: titulo.trim(), description: descripcion.trim() || null },
      { onSuccess: () => setEditando(false) }
    );
  };

  const confirmarBaja = () => {
    eliminar.mutate(undefined, {
      onSuccess: () => {
        setConfirmandoBaja(false);
        router.replace('/(tabs)/favores');
      },
    });
  };

  return (
    <Screen>
      <StatusBanner variant="desactivado" visible={favor.isDeactivated} />
      <StatusBanner variant="revision" visible={!favor.isDeactivated && favor.moderationStatus === 'pendiente'} />
      {esMio && favor.isDeactivated && favor.moderationStatus === 'rechazado' && favor.moderationReason ? (
        <Text style={[styles.motivo, { color: p.body }]}>Motivo del administrador: {favor.moderationReason}</Text>
      ) : null}

      {/* El backend vacía el contenido de un favor desactivado salvo para su autor. */}
      {favor.title ? (
        <Card backgroundColor={favorTypeBackground[favor.type]}>
          {favor.moderationStatus === 'aprobado' ? <UrgencyBadge urgency={favor.urgency} /> : null}
          <Text style={[styles.tipo, { color: p.muted }]}>{favorTypeLabel[favor.type]}</Text>
          <Text style={[styles.titulo, { color: colors.azul }]}>{favor.title}</Text>
          {favor.description ? <Text style={styles.descripcion}>{favor.description}</Text> : null}
          <View style={styles.meta}>
            <Text style={styles.metaText}>Publicado por {esMio ? 'ti' : favor.author.fullName}</Text>
            <Text style={styles.metaText}>Estado: {favorStatusLabel[favor.status]}</Text>
            <Text style={styles.metaText}>
              {favor.interestedCount === 1 ? '1 vecino interesado' : `${favor.interestedCount} vecinos interesados`}
            </Text>
          </View>
        </Card>
      ) : null}

      {favor.isDeactivated ? null : esMio ? (
        <>
          {conversaciones.data && conversaciones.data.length > 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[styles.seccion, { color: p.text }]}>Vecinos que quieren ayudarte</Text>
              {conversaciones.data.map((c) => (
                <Card key={c.id} onPress={() => router.push(`/chat/${c.id}`)}>
                  <View style={styles.vecinoFila}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.vecinoNombre, { color: p.text }]}>
                        {c.responder?.full_name ?? 'Vecino'}
                      </Text>
                      <Text style={[styles.vecinoDetalle, { color: p.muted }]}>
                        {c.closed_at ? 'Conversación cerrada' : c.last_message_at ? `Último mensaje ${timeAgo(c.last_message_at)}` : 'Aún sin mensajes'}
                      </Text>
                    </View>
                    <Ionicons name="chatbubble-ellipses-outline" size={24} color={p.primary} />
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <Text style={[styles.nota, { color: p.muted }]}>
              Esta es tu publicación. Los vecinos que respondan aparecerán aquí para chatear.
            </Text>
          )}
          <View style={{ marginTop: spacing.md }}>
            {favor.canEdit ? (
              <AppButton label="Editar" variant="secondary" icon="create-outline" onPress={abrirEdicion} />
            ) : null}
            <AppButton
              label="Eliminar favor"
              variant="danger"
              icon="trash-outline"
              onPress={() => {
                eliminar.reset();
                setConfirmandoBaja(true);
              }}
            />
          </View>
        </>
      ) : favor.hasInterestedByMe ? (
        <>
          <Text style={[styles.nota, { color: p.primary }]}>Ya le avisaste a este vecino que puedes ayudar.</Text>
          {conversaciones.data?.[0] ? (
            <View style={{ marginTop: spacing.md }}>
              <AppButton
                label="Abrir chat"
                variant="accent"
                icon="chatbubble-ellipses-outline"
                onPress={() => router.push(`/chat/${conversaciones.data![0].id}`)}
              />
            </View>
          ) : null}
        </>
      ) : abierto ? (
        <>
          {interes.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              No se pudo registrar tu interés: {interes.error.message}
            </Text>
          ) : null}
          <AppButton
            label={interes.isPending ? 'Enviando...' : 'Me interesa, puedo ayudar'}
            variant="accent"
            onPress={() =>
              interes.mutate(undefined, { onSuccess: (r) => router.push(`/chat/${r.conversation_id}`) })
            }
            disabled={interes.isPending}
          />
        </>
      ) : (
        <Text style={[styles.nota, { color: p.muted }]}>Este favor ya está cerrado.</Text>
      )}

      {!esMio ? (
        <Pressable accessibilityRole="button" onPress={abrirReporte} style={styles.reportar}>
          <Ionicons name="flag-outline" size={15} color={p.muted} />
          <Text style={[styles.reportarTexto, { color: p.muted }]}>Reportar este favor</Text>
        </Pressable>
      ) : null}

      <Modal visible={editando} transparent animationType="slide" onRequestClose={() => setEditando(false)}>
        <Pressable style={styles.hoja} onPress={() => setEditando(false)}>
          {/* Pressable vacío: los toques dentro de la tarjeta no llegan al fondo que cierra el modal. */}
          <Pressable onPress={() => {}} style={styles.hojaTarjeta}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitulo, { color: p.text }]}>Editar favor</Text>

              <Text style={[styles.inputLabel, { color: p.text }]}>Tipo</Text>
              <View style={styles.chips}>
                {tipos.map((t) => (
                  <Chip key={t} label={favorTypeLabel[t]} selected={tipo === t} onPress={() => setTipo(t)} />
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: p.text }]}>Título</Text>
              <TextInput
                value={titulo}
                onChangeText={setTitulo}
                maxLength={120}
                multiline
                accessibilityLabel="Título"
                style={[styles.input, { borderColor: p.border, color: p.text }]}
              />

              <Text style={[styles.inputLabel, { color: p.text }]}>Descripción (opcional)</Text>
              <TextInput
                value={descripcion}
                onChangeText={setDescripcion}
                multiline
                accessibilityLabel="Descripción"
                style={[styles.input, { minHeight: 80, borderColor: p.border, color: p.text }]}
              />

              <Text style={[styles.aviso, { color: p.muted }]}>
                Al guardar, tu favor se actualiza al instante para los vecinos de tu zona.
              </Text>

              {actualizar.error ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  No se pudo guardar: {actualizar.error.message}
                </Text>
              ) : null}

              <View style={{ marginTop: spacing.md }}>
                <AppButton
                  label={actualizar.isPending ? 'Guardando...' : 'Guardar cambios'}
                  onPress={guardarEdicion}
                  disabled={titulo.trim().length < 3 || actualizar.isPending}
                />
                <AppButton label="Cancelar" variant="link" onPress={() => setEditando(false)} />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={confirmandoBaja} transparent animationType="fade" onRequestClose={() => setConfirmandoBaja(false)}>
        <Pressable style={styles.overlay} onPress={() => setConfirmandoBaja(false)}>
          <Pressable onPress={() => {}} style={styles.tarjeta}>
            <Text style={[styles.modalTitulo, { color: p.text }]}>¿Eliminar este favor?</Text>
            <Text style={[styles.modalTexto, { color: p.body }]}>
              Dejará de verse en el barrio y ya no podrás reactivarlo.
            </Text>
            {eliminar.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                No se pudo eliminar: {eliminar.error.message}
              </Text>
            ) : null}
            <AppButton
              label={eliminar.isPending ? 'Eliminando...' : 'Sí, eliminar'}
              variant="danger"
              onPress={confirmarBaja}
              disabled={eliminar.isPending}
            />
            <AppButton label="Cancelar" variant="secondary" onPress={() => setConfirmandoBaja(false)} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de reporte compatible con Web y Móvil */}
      <Modal visible={reportando} transparent animationType="fade" onRequestClose={() => setReportando(false)}>
        <Pressable style={styles.overlay} onPress={() => setReportando(false)}>
          <Pressable onPress={() => {}} style={styles.tarjeta}>
            {reporteEnviado ? (
              <>
                <Text style={[styles.modalTitulo, { color: p.text }]}>Gracias por avisar</Text>
                <Text style={[styles.modalTexto, { color: p.body }]}>
                  {reporteEnviado.hidden
                    ? 'Este favor acumuló suficientes reportes de vecinos y fue ocultado del barrio.'
                    : 'Registramos tu reporte. Si varios vecinos reportan este favor, se ocultará automáticamente.'}
                </Text>
                <AppButton
                  label="Entendido"
                  onPress={() => {
                    const oculto = reporteEnviado.hidden;
                    setReportando(false);
                    setReporteEnviado(null);
                    if (oculto) router.navigate('/(tabs)/favores');
                  }}
                />
              </>
            ) : (
              <>
                <Text style={[styles.modalTitulo, { color: p.text }]}>Reportar favor</Text>
                <Text style={[styles.modalTexto, { color: p.body }]}>
                  Elige el motivo del reporte. Si varios vecinos lo reportan, se oculta automáticamente.
                </Text>
                {reportar.error ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {(reportar.error as Error).message}
                  </Text>
                ) : null}
                {MOTIVOS_REPORTE.map((m) => (
                  <AppButton
                    key={m.reason}
                    label={m.label}
                    variant="secondary"
                    icon="flag-outline"
                    disabled={reportar.isPending}
                    onPress={() => enviarReporte(m.reason)}
                  />
                ))}
                <AppButton
                  label="Cancelar"
                  variant="link"
                  disabled={reportar.isPending}
                  onPress={() => setReportando(false)}
                />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  reportar: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: spacing.lg, padding: spacing.sm },
  reportarTexto: { fontFamily: fonts.medium, fontSize: 14, textDecorationLine: 'underline' },
  tipo: { fontFamily: fonts.semiBold, fontSize: 14 },
  titulo: { fontFamily: fonts.bold, fontSize: 22, marginTop: 4 },
  descripcion: { fontFamily: fonts.regular, fontSize: 16, color: colors.texto, marginTop: spacing.sm, lineHeight: 22 },
  meta: { marginTop: spacing.md, gap: 4 },
  metaText: { fontFamily: fonts.medium, fontSize: 14, color: colors.texto },
  nota: { fontFamily: fonts.medium, fontSize: 15, textAlign: 'center', marginTop: spacing.md },
  seccion: { fontFamily: fonts.bold, fontSize: 18, marginBottom: spacing.sm },
  vecinoFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vecinoNombre: { fontFamily: fonts.bold, fontSize: 16 },
  vecinoDetalle: { fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  motivo: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, marginBottom: 12 },
  error: { color: colors.rojo, fontSize: 14, fontFamily: fonts.medium, lineHeight: 20, marginBottom: spacing.sm },
  aviso: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, marginTop: spacing.sm },

  hoja: { flex: 1, backgroundColor: 'rgba(19, 46, 102, 0.45)', justifyContent: 'flex-end' },
  hojaTarjeta: {
    backgroundColor: colors.blanco,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  inputLabel: { fontSize: 15, fontFamily: fonts.semiBold, marginBottom: 6, marginTop: spacing.sm },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 16,
    fontFamily: fonts.regular,
    textAlignVertical: 'top',
    marginBottom: spacing.xs,
  },

  overlay: { flex: 1, backgroundColor: 'rgba(19, 46, 102, 0.5)', justifyContent: 'center', padding: spacing.lg },
  tarjeta: { backgroundColor: colors.blanco, borderRadius: radius.xl, padding: spacing.lg },
  modalTitulo: { fontFamily: fonts.bold, fontSize: 22, marginBottom: spacing.sm },
  modalTexto: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, marginBottom: spacing.md },
});
