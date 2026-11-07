import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { StatusBanner } from '@/components/StatusBanner';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import { usePalette } from '@/hooks/usePalette';
import { useDeleteFavor, useExpressInterest, useFavor, useUpdateFavor } from '@/hooks/useData';
import { favorStatusLabel, favorTypeBackground, favorTypeLabel } from '@/i18n/labels';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, radius, spacing } from '@/theme';
import type { FavorType } from '@/types';

const tipos = Object.keys(favorTypeLabel) as FavorType[];

export default function FavorDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const userId = useAppStore((s) => s.userId);
  const { data: favor, isLoading, isError, error, refetch } = useFavor(id);
  const interes = useExpressInterest(id);
  const actualizar = useUpdateFavor(id);
  const eliminar = useDeleteFavor(id);

  const [editando, setEditando] = useState(false);
  const [tipo, setTipo] = useState<FavorType>('otros');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={p.primary} style={{ marginTop: spacing.xl }} />
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
          <Text style={[styles.nota, { color: p.muted }]}>
            Esta es tu publicación. Los vecinos interesados aparecerán aquí.
          </Text>
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
        <Text style={[styles.nota, { color: p.primary }]}>Ya le avisaste a este vecino que puedes ayudar.</Text>
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
            onPress={() => interes.mutate(undefined)}
            disabled={interes.isPending}
          />
        </>
      ) : (
        <Text style={[styles.nota, { color: p.muted }]}>Este favor ya está cerrado.</Text>
      )}

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
                Al guardar, tu favor volverá a revisión y los vecinos no lo verán hasta que un administrador lo apruebe.
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  tipo: { fontFamily: fonts.semiBold, fontSize: 14 },
  titulo: { fontFamily: fonts.bold, fontSize: 22, marginTop: 4 },
  descripcion: { fontFamily: fonts.regular, fontSize: 16, color: colors.texto, marginTop: spacing.sm, lineHeight: 22 },
  meta: { marginTop: spacing.md, gap: 4 },
  metaText: { fontFamily: fonts.medium, fontSize: 14, color: colors.texto },
  nota: { fontFamily: fonts.medium, fontSize: 15, textAlign: 'center', marginTop: spacing.md },
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
