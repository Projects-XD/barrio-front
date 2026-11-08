import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
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
  useFavors,
  useMySavedLocation,
  useProfiles,
  useReportFavor,
  useUpdateFavor,
} from '@/hooks/useData';
import { favorStatusLabel, favorTypeBackground, favorTypeLabel } from '@/i18n/labels';
import type { IconName } from '@/i18n/icons';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, radius, spacing } from '@/theme';
import type { FavorType } from '@/types';
import { formatDistanceAndWalk } from '@/utils/geo';
import { findMatchesForFavor } from '@/utils/matching';
import { shareFavorWhatsApp } from '@/utils/share';
import { timeAgo } from '@/utils/time';
import { AppModal } from '@/components/AppModal';

const tipos = Object.keys(favorTypeLabel) as FavorType[];

const MOTIVOS_REPORTE = [
  { label: 'Es broma o spam', reason: 'Broma o spam' },
  { label: 'No es una ayuda real', reason: 'No es una ayuda real' },
  { label: 'Contenido ofensivo', reason: 'Contenido ofensivo' },
] as const;

function MenuRow({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const p = usePalette();
  const color = danger ? colors.rojo : p.text;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.menuRow}>
      <Ionicons name={icon} size={20} color={danger ? colors.rojo : colors.azul} />
      <Text style={[styles.menuRowText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export default function FavorDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const userId = useAppStore((s) => s.userId);
  const { data: favor, isLoading, isError, error, refetch } = useFavor(id);
  const { data: allProfiles = [] } = useProfiles();
  const { data: allFavors = [] } = useFavors();
  const { data: savedLocation } = useMySavedLocation();
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
  const [modalResolver, setModalResolver] = useState<{ responderId: string | null; responderName: string } | null>(null);
  const [reconocimientoExito, setReconocimientoExito] = useState<string | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const refCoords = useMemo(
    () => favor?.location ?? (savedLocation ? { lat: savedLocation.lat, lng: savedLocation.lng } : null),
    [favor?.location, savedLocation],
  );

  const sugerencias = useMemo(() => {
    if (!favor || favor.isDeactivated) return [];
    const esOferta = /^(ofrezco|ofrece|tengo\s+para\s+prestar|presto|dono|regalo|puedo\s+ayudar|puedo\s+enseñar)/i.test(
      favor.title,
    );
    if (esOferta) return [];
    return findMatchesForFavor({
      favorType: favor.type,
      title: favor.title,
      description: favor.description,
      authorId: favor.authorId,
      referenceCoords: refCoords,
      profiles: allProfiles,
      favors: allFavors.filter((f) => f.id !== favor.id),
      limit: 3,
    });
  }, [favor, refCoords, allProfiles, allFavors]);

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
  const resuelto = favor.status === 'cerrada';

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

  const confirmarResolucion = () => {
    if (!modalResolver || actualizar.isPending) return;
    const helperName = modalResolver.responderName;
    actualizar.mutate(
      {
        status: 'cerrada',
        ...(modalResolver.responderId ? { assigned_to_user_id: modalResolver.responderId } : {}),
      },
      {
        onSuccess: () => {
          setModalResolver(null);
          setReconocimientoExito(helperName);
          refetch();
        },
      },
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
      <Stack.Screen
        options={{
          title: favor.intent === 'ofrecer' ? 'Detalle del ofrecimiento' : 'Detalle de la ayuda',
          headerBackTitle: 'Volver',
        }}
      />
      <StatusBanner variant="desactivado" visible={favor.isDeactivated} />
      <StatusBanner variant="revision" visible={!favor.isDeactivated && favor.moderationStatus === 'pendiente'} />
      {esMio && favor.isDeactivated && favor.moderationStatus === 'rechazado' && favor.moderationReason ? (
        <Text style={[styles.motivo, { color: p.body }]}>Motivo del administrador: {favor.moderationReason}</Text>
      ) : null}

      {/* Tarjeta de celebración cuando el favor ya fue resuelto */}
      {resuelto && !favor.isDeactivated ? (
        <View style={styles.resolvedBanner}>
          <View style={styles.resolvedIconCircle}>
            <Ionicons name="checkmark-circle" size={22} color={colors.verdeExito} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.resolvedTitle}>Favor resuelto en comunidad</Text>
            <Text style={styles.resolvedSub}>
              {reconocimientoExito
                ? `Agradeciste el apoyo solidario de ${reconocimientoExito}.`
                : 'Este favor se completó gracias al apoyo entre vecinos del barrio.'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* El backend vacía el contenido de un favor desactivado salvo para su autor. */}
      {favor.title ? (
        <Card backgroundColor={favorTypeBackground[favor.type]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderInfo}>
              <View style={styles.badgeRow}>
                <Text
                  style={[
                    styles.tagText,
                    {
                      color: favor.intent === 'ofrecer' ? colors.verdeExito : colors.naranja,
                      fontFamily: fonts.semiBold,
                    },
                  ]}
                >
                  {favor.intent === 'ofrecer' ? 'OFRECIMIENTO' : 'PEDIDO'} · {favorTypeLabel[favor.type].toUpperCase()}
                </Text>

                {esMio ? (
                  <View style={styles.mineTag}>
                    <Text style={styles.mineText}>Tuya</Text>
                  </View>
                ) : null}

                {favor.moderationStatus === 'aprobado' ? <UrgencyBadge urgency={favor.urgency} /> : null}
              </View>
            </View>
            {!favor.isDeactivated ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Opciones del favor"
                hitSlop={10}
                onPress={() => setMenuAbierto(true)}
                style={styles.cardMenuTrigger}
              >
                <Ionicons name="ellipsis-vertical" size={18} color={colors.azul} />
              </Pressable>
            ) : null}
          </View>
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
              {conversaciones.data.map((c) => {
                const nombreVecino = c.responder?.full_name ?? 'Vecino';
                return (
                  <Card key={c.id}>
                    <View style={styles.vecinoFila}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir chat con ${nombreVecino}`}
                        onPress={() => router.push(`/chat/${c.id}`)}
                        style={styles.vecinoMainArea}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.vecinoNombre, { color: p.text }]}>{nombreVecino}</Text>
                          <Text style={[styles.vecinoDetalle, { color: p.muted }]}>
                            {c.closed_at
                              ? 'Conversación cerrada'
                              : c.last_message_at
                                ? `Último mensaje ${timeAgo(c.last_message_at)}`
                                : 'Toca para abrir el chat'}
                          </Text>
                        </View>
                        <Ionicons name="chatbubble-ellipses-outline" size={20} color={p.primary} />
                      </Pressable>
                    </View>
                  </Card>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.nota, { color: p.muted }]}>
              Esta es tu publicación. Los vecinos que respondan aparecerán aquí para chatear.
            </Text>
          )}
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

      {/* Emparejamiento Inteligente: Vecinos u oficios cercanos que coinciden con este favor */}
      {abierto && sugerencias.length > 0 ? (
        <View style={styles.matchSection}>
          <Text style={[styles.seccion, { color: p.text, marginBottom: 2 }]}>
            Vecinos en tu zona que podrían darte una mano
          </Text>
          <Text style={[styles.matchSub, { color: p.muted }]}>
            Sugerencias automáticas según la especialidad y cercanía en tu barrio.
          </Text>
          {sugerencias.map((s) => {
            const distTxt = formatDistanceAndWalk(s.distanceMeters);
            return (
              <Card key={s.id} onPress={() => router.push(s.targetRoute as never)}>
                <View style={styles.matchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.matchTitle, { color: p.text }]} numberOfLines={1}>
                      {s.title}
                    </Text>
                    <Text style={[styles.matchDesc, { color: p.body }]} numberOfLines={2}>
                      {s.subtitle}
                    </Text>
                    <Text style={[styles.matchMeta, { color: p.muted }]}>
                      {[s.meta, distTxt].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.gris} />
                </View>
              </Card>
            );
          })}
        </View>
      ) : null}

      {/* Menú contextual (⋮): todas las acciones secundarias del favor */}
      <AppModal visible={menuAbierto} onClose={() => setMenuAbierto(false)} animationType="fade" overlayStyle={styles.overlay} cardStyle={styles.menuCard}>
                    <Text style={[styles.menuTitulo, { color: p.text }]}>Opciones del favor</Text>

            {esMio && abierto ? (
              <MenuRow
                icon="checkmark-circle-outline"
                label="Marcar como resuelto"
                onPress={() => {
                  setMenuAbierto(false);
                  const primerVecino = conversaciones.data?.[0];
                  setModalResolver({
                    responderId: primerVecino?.responder_id ?? null,
                    responderName: primerVecino?.responder?.full_name ?? 'tu vecino',
                  });
                }}
              />
            ) : null}
            {esMio && abierto && favor.canEdit ? (
              <MenuRow
                icon="create-outline"
                label="Editar favor"
                onPress={() => {
                  setMenuAbierto(false);
                  abrirEdicion();
                }}
              />
            ) : null}
            <MenuRow
              icon="logo-whatsapp"
              label="Compartir en WhatsApp del barrio"
              onPress={() => {
                setMenuAbierto(false);
                shareFavorWhatsApp(favor);
              }}
            />
            {!esMio ? (
              <MenuRow
                icon="flag-outline"
                label="Reportar este favor"
                onPress={() => {
                  setMenuAbierto(false);
                  abrirReporte();
                }}
              />
            ) : null}
            {esMio ? (
              <MenuRow
                icon="trash-outline"
                label="Eliminar favor"
                danger
                onPress={() => {
                  setMenuAbierto(false);
                  eliminar.reset();
                  setConfirmandoBaja(true);
                }}
              />
            ) : null}
            <View style={{ marginTop: spacing.xs }}>
              <AppButton label="Cancelar" variant="secondary" onPress={() => setMenuAbierto(false)} />
            </View>
      </AppModal>

      {/* Modal para confirmar Cierre de Favor con Reconocimiento Vecinal */}
      <AppModal visible={modalResolver !== null} onClose={() => setModalResolver(null)} animationType="fade" overlayStyle={styles.overlay} cardStyle={styles.tarjeta}>
                    <Text style={[styles.modalTitulo, { color: p.text }]}>¿Se resolvió tu favor?</Text>
            <Text style={[styles.modalTexto, { color: p.body }]}>
              {modalResolver?.responderId
                ? `Se marcará como resuelto y enviaremos un reconocimiento vecinal a ${modalResolver.responderName} por su ayuda solidaria.`
                : 'Tu favor pasará a estado resuelto y sumará al historial positivo de ayuda en tu zona.'}
            </Text>
            {(conversaciones.data?.length ?? 0) > 1 ? (
              <View style={styles.chips}>
                {conversaciones.data!.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.responder?.full_name ?? 'Vecino'}
                    selected={modalResolver?.responderId === c.responder_id}
                    onPress={() =>
                      setModalResolver({
                        responderId: c.responder_id,
                        responderName: c.responder?.full_name ?? 'Vecino',
                      })
                    }
                  />
                ))}
              </View>
            ) : null}
            {actualizar.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                No se pudo actualizar: {actualizar.error.message}
              </Text>
            ) : null}
            <AppButton
              label={
                actualizar.isPending
                  ? 'Guardando...'
                  : modalResolver?.responderId
                    ? `Resolver y agradecer a ${modalResolver.responderName}`
                    : 'Sí, marcar como resuelto'
              }
              variant="accent"
              icon="checkmark-circle-outline"
              disabled={actualizar.isPending}
              onPress={confirmarResolucion}
            />
            <AppButton
              label="Cancelar"
              variant="secondary"
              disabled={actualizar.isPending}
              onPress={() => setModalResolver(null)}
            />
      </AppModal>

      <AppModal visible={editando} onClose={() => setEditando(false)} animationType="slide" overlayStyle={styles.hoja} cardStyle={styles.hojaTarjeta}>
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
                <AppButton label="Cancelar" variant="secondary" onPress={() => setEditando(false)} />
              </View>
            </ScrollView>
      </AppModal>

      <AppModal visible={confirmandoBaja} onClose={() => setConfirmandoBaja(false)} animationType="fade" overlayStyle={styles.overlay} cardStyle={styles.tarjeta}>
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
      </AppModal>

      {/* Modal de reporte compatible con Web y Móvil */}
      <AppModal visible={reportando} onClose={() => setReportando(false)} animationType="fade" overlayStyle={styles.overlay} cardStyle={styles.tarjeta}>
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
                  variant="secondary"
                  disabled={reportar.isPending}
                  onPress={() => setReportando(false)}
                />
              </>
            )}
      </AppModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  mineTag: {
    backgroundColor: colors.azulSuave,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
  },
  mineText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.azul,
  },
  tagText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardHeaderInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  cardMenuTrigger: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fondo,
  },
  resolvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.verdeExitoSuave,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  resolvedIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.blanco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolvedTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.verdeExito,
  },
  resolvedSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.texto,
    marginTop: 2,
    lineHeight: 18,
  },
  shareRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(19, 46, 102, 0.1)',
  },
  shareRowText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.azul,
  },
  reportar: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: spacing.lg, padding: spacing.sm },
  reportarTexto: { fontFamily: fonts.medium, fontSize: 14, textDecorationLine: 'underline' },
  tipo: { fontFamily: fonts.semiBold, fontSize: 14 },
  titulo: { fontFamily: fonts.bold, fontSize: 22, marginTop: 4 },
  descripcion: { fontFamily: fonts.regular, fontSize: 16, color: colors.texto, marginTop: spacing.sm, lineHeight: 22 },
  meta: { marginTop: spacing.md, gap: 4 },
  metaText: { fontFamily: fonts.medium, fontSize: 14, color: colors.texto },
  nota: { fontFamily: fonts.medium, fontSize: 15, textAlign: 'center', marginTop: spacing.md },
  seccion: { fontFamily: fonts.section, fontSize: 18, marginBottom: spacing.sm },
  vecinoFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vecinoMainArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  vecinoNombre: { fontFamily: fonts.bold, fontSize: 16 },
  vecinoDetalle: { fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  agradecerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.verdeExitoSuave,
  },
  agradecerPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.verdeExito,
  },
  matchSection: {
    marginTop: spacing.lg,
  },
  matchSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  matchTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  matchDesc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  matchMeta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 4,
  },
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

  menuCard: { backgroundColor: colors.blanco, borderRadius: radius.xl, padding: spacing.lg, width: '100%', maxWidth: 400, alignSelf: 'center' },
  menuTitulo: { fontFamily: fonts.bold, fontSize: 18, marginBottom: spacing.xs },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 6 },
  menuRowText: { fontFamily: fonts.semiBold, fontSize: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(19, 46, 102, 0.5)', justifyContent: 'center', padding: spacing.lg },
  tarjeta: { backgroundColor: colors.blanco, borderRadius: radius.xl, padding: spacing.lg },
  modalTitulo: { fontFamily: fonts.bold, fontSize: 22, marginBottom: spacing.sm },
  modalTexto: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, marginBottom: spacing.md },
});
