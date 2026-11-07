import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import { usePalette } from '@/hooks/usePalette';
import { useApproveFavor, useIsAdmin, usePendingFavors, useRejectFavor } from '@/hooks/useData';
import { favorTypeLabel } from '@/i18n/labels';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, radius, spacing } from '@/theme';
import type { Favor } from '@/types';
import { timeAgo } from '@/utils/time';

const MIN_MOTIVO = 3;
const MAX_MOTIVO = 500;

function PendingFavorCard({ favor }: { favor: Favor }) {
  const p = usePalette();
  const aprobar = useApproveFavor(favor.id);
  const rechazar = useRejectFavor(favor.id);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const ocupado = aprobar.isPending || rechazar.isPending;

  const abrirRechazo = () => {
    rechazar.reset();
    setMotivo('');
    setRechazando(true);
  };

  const confirmarRechazo = () => {
    rechazar.mutate(motivo.trim(), { onSuccess: () => setRechazando(false) });
  };

  return (
    <Card>
      <UrgencyBadge urgency={favor.urgency} />
      <Text style={[styles.tipo, { color: p.muted }]}>{favorTypeLabel[favor.type]}</Text>
      <Text style={[styles.titulo, { color: p.text }]}>{favor.title}</Text>
      {favor.description ? <Text style={[styles.descripcion, { color: p.body }]}>{favor.description}</Text> : null}
      <Text style={[styles.meta, { color: p.muted }]}>
        {favor.author.fullName} · {timeAgo(favor.createdAt)}
      </Text>

      {aprobar.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {aprobar.error.message}
        </Text>
      ) : null}

      <View style={styles.acciones}>
        <View style={styles.accion}>
          <AppButton
            label={aprobar.isPending ? 'Aprobando...' : 'Aprobar'}
            variant="success"
            icon="checkmark"
            disabled={ocupado}
            onPress={() => aprobar.mutate()}
          />
        </View>
        <View style={styles.accion}>
          <AppButton label="Rechazar" variant="danger" icon="close" disabled={ocupado} onPress={abrirRechazo} />
        </View>
      </View>

      <Modal visible={rechazando} transparent animationType="fade" onRequestClose={() => setRechazando(false)}>
        <Pressable style={styles.overlay} onPress={() => setRechazando(false)}>
          <Pressable onPress={() => {}} style={styles.tarjeta}>
            <Text style={[styles.modalTitulo, { color: p.text }]}>¿Por qué rechazas este favor?</Text>
            <Text style={[styles.modalTexto, { color: p.body }]}>
              El favor se retirará del barrio y su autor verá este motivo.
            </Text>
            <TextInput
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Escribe el motivo..."
              placeholderTextColor={colors.gris}
              multiline
              maxLength={MAX_MOTIVO}
              accessibilityLabel="Motivo del rechazo"
              style={[styles.input, { borderColor: p.border, color: p.text }]}
            />
            {rechazar.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {rechazar.error.message}
              </Text>
            ) : null}
            <AppButton
              label={rechazar.isPending ? 'Rechazando...' : 'Rechazar favor'}
              variant="danger"
              disabled={motivo.trim().length < MIN_MOTIVO || rechazar.isPending}
              onPress={confirmarRechazo}
            />
            <AppButton label="Cancelar" variant="secondary" onPress={() => setRechazando(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Card>
  );
}

export default function AdminPanel() {
  const p = usePalette();
  const hydrated = useAppStore((s) => s.hydrated);
  const isAdmin = useIsAdmin();
  const pendientes = usePendingFavors(isAdmin.data === true);

  if (!hydrated || isAdmin.isLoading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={p.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  // Un fallo de red no es lo mismo que no tener permiso.
  if (isAdmin.isError) {
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="No pudimos verificar tu acceso" message={isAdmin.error.message} />
        <AppButton label="Reintentar" variant="secondary" icon="refresh" onPress={() => isAdmin.refetch()} />
      </Screen>
    );
  }

  if (!isAdmin.data) {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed-outline"
          title="Acceso denegado"
          message="Esta sección es solo para administradores de la zona."
        />
        <AppButton label="Volver al inicio" variant="secondary" onPress={() => router.replace('/(tabs)/inicio')} />
      </Screen>
    );
  }

  const favores = pendientes.data ?? [];

  return (
    <Screen>
      <Text style={[styles.encabezado, { color: p.text }]}>Favores por revisar</Text>
      <Text style={[styles.sub, { color: p.muted }]}>
        Si apruebas, el favor se publica en el barrio. Si rechazas, se retira y su autor verá el motivo.
      </Text>

      {pendientes.isLoading ? (
        <ActivityIndicator size="large" color={p.primary} style={{ marginTop: spacing.xl }} />
      ) : pendientes.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="No pudimos cargar la cola"
          message={pendientes.error.message}
        />
      ) : favores.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" title="Todo al día" message="No hay favores pendientes en tu zona." />
      ) : (
        favores.map((favor) => <PendingFavorCard key={favor.id} favor={favor} />)
      )}

      <AppButton
        label={pendientes.isFetching ? 'Actualizando...' : 'Actualizar'}
        variant="link"
        disabled={pendientes.isFetching}
        onPress={() => pendientes.refetch()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  encabezado: { fontSize: 26, fontFamily: fonts.bold, lineHeight: 32 },
  sub: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22, marginTop: 6, marginBottom: spacing.md },
  tipo: { fontFamily: fonts.semiBold, fontSize: 14 },
  titulo: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, marginTop: 2 },
  descripcion: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, marginTop: spacing.xs },
  meta: { fontFamily: fonts.regular, fontSize: 14, marginTop: spacing.sm },
  acciones: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  accion: { flex: 1 },
  error: { color: colors.rojo, fontSize: 14, fontFamily: fonts.medium, lineHeight: 20, marginTop: spacing.sm, marginBottom: spacing.sm },
  overlay: { flex: 1, backgroundColor: 'rgba(19, 46, 102, 0.5)', justifyContent: 'center', padding: spacing.lg },
  tarjeta: { backgroundColor: colors.blanco, borderRadius: radius.xl, padding: spacing.lg },
  modalTitulo: { fontFamily: fonts.bold, fontSize: 22, marginBottom: spacing.sm },
  modalTexto: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, marginBottom: spacing.md },
  input: {
    minHeight: 96,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 16,
    fontFamily: fonts.regular,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
});
