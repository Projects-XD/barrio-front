import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useProfile, useVouch } from '@/hooks/useData';
import { useAppStore } from '@/store/app-store';
import { oficioLabel } from '@/i18n/labels';
import { colors, fonts, radius, spacing } from '@/theme';

export default function OficioDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const { data: profile, isLoading } = useProfile(id);
  const vouch = useVouch(id);
  const [showContactModal, setShowContactModal] = useState(false);
  const userId = useAppStore((s) => s.userId);
  const esMio = Boolean(userId) && profile?.userId === userId;

  const handleVouch = async () => {
    if (esMio) return;
    if (!profile) return;
    try {
      await vouch.mutateAsync();
      Alert.alert(
        '¡Visto Bueno Registrado!',
        `Has respaldado exitosamente el trabajo de ${profile.user.fullName}. Tu confianza ayuda a mantener seguro el barrio.`
      );
    } catch (err: any) {
      const errorMsg =
        err?.message ||
        'No se pudo registrar el visto bueno. Recuerda que solo vecinos de la misma zona pueden validar un perfil.';
      Alert.alert('No se pudo otorgar el visto bueno', errorMsg);
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={p.primary} />
        </View>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <EmptyState title="Perfil no disponible" message="Este perfil no se encuentra en tu zona." />
      </Screen>
    );
  }

  const handleWhatsApp = () => {
    setShowContactModal(false);
    const msg = encodeURIComponent(
      `Hola ${profile.user.fullName}, vi tu perfil de ${oficioLabel[profile.oficio.category]} en la app Barrio.`
    );
    Linking.openURL(`https://wa.me/?text=${msg}`).catch(() => {
      Alert.alert('WhatsApp', 'No se pudo abrir WhatsApp.');
    });
  };

  const stats = [
    {
      value: `${profile.validatedCount}`,
      label: profile.validatedCount === 1 ? 'Aval vecinal' : 'Avales vecinales',
    },
    ...(profile.distanceKm !== undefined
      ? [{ value: `${profile.distanceKm} km`, label: 'En tu zona' }]
      : []),
    ...(profile.yearsExperience
      ? [{ value: `${profile.yearsExperience} años`, label: 'Experiencia' }]
      : []),
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Detalle de oficio', headerBackTitle: 'Volver' }} />

      {/* Tarjeta principal con jerarquía limpia */}
      <Card>
        <View style={styles.headerInfo}>
          <Text style={[styles.nombre, { color: p.text }]}>{profile.user.fullName}</Text>
          <Text style={styles.oficio}>{oficioLabel[profile.oficio.category]}</Text>
        </View>

        {/* Barra de métricas tipográfica */}
        <View style={styles.statsBar}>
          {stats.map((st, idx) => (
            <View key={st.label} style={styles.statColWrapper}>
              {idx > 0 ? <View style={styles.statDivider} /> : null}
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{st.value}</Text>
                <Text style={styles.statLabel}>{st.label}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        <Text style={[styles.seccionTitulo, { color: p.text }]}>Sobre el servicio</Text>
        <Text style={[styles.descripcion, { color: colors.texto }]}>{profile.description}</Text>
      </Card>

      {/* Nota comunitaria sutil y humana */}
      <View style={styles.notaComunitaria}>
        <Text style={styles.notaTexto}>
          {profile.validatedCount >= 2
            ? 'Perfil validado con visto bueno de vecinos de Castilla. Las recomendaciones son otorgadas únicamente por residentes de la misma zona.'
            : 'Este oficio necesita 2 vistos buenos de vecinos de Castilla para considerarse oficialmente validado.'}
        </Text>
      </View>

      {/* Botones de acción con lógica para el propio técnico */}
      <View style={styles.actionButtons}>
        {!esMio ? (
          <AppButton
            label="Contactar técnico"
            variant="accent"
            onPress={() => setShowContactModal(true)}
          />
        ) : null}

        <AppButton
          label={
            esMio
              ? 'Es tu perfil profesional'
              : profile.hasVouchedByMe
                ? 'Visto bueno registrado'
                : vouch.isPending
                  ? 'Registrando visto bueno...'
                  : 'Dar visto bueno'
          }
          variant={esMio ? 'secondary' : 'secondary'}
          onPress={handleVouch}
          disabled={esMio || profile.hasVouchedByMe || vouch.isPending}
        />
      </View>

      {/* Modal de opciones de contacto vecinal */}
      <Modal
        visible={showContactModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContactModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowContactModal(false)}>
          <Pressable onPress={() => {}} style={[styles.modalContent, { backgroundColor: colors.blanco }]}>
            <Text style={[styles.modalTitle, { color: p.text }]}>Contactar a {profile.user.fullName}</Text>
            <Text style={[styles.modalSubtitle, { color: p.muted }]}>
              Coordina el servicio de forma directa y transparente con tu vecino.
            </Text>

            <View style={styles.modalButtonsStack}>
              <AppButton
                label="Escribir por WhatsApp"
                variant="accent"
                icon="logo-whatsapp"
                onPress={handleWhatsApp}
              />
              <AppButton
                label="Cerrar"
                variant="secondary"
                onPress={() => setShowContactModal(false)}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerInfo: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  nombre: {
    fontSize: 22,
    fontFamily: fonts.bold,
    textAlign: 'center',
    marginBottom: 4,
  },
  oficio: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.naranja,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.naranjaClaro,
    borderRadius: radius.md,
    marginVertical: spacing.xs,
  },
  statColWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(19, 46, 102, 0.1)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.azul,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.gris,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.grisBorde,
    marginVertical: spacing.md,
  },
  seccionTitulo: {
    fontSize: 15,
    fontFamily: fonts.bold,
    marginBottom: spacing.xs,
  },
  descripcion: {
    fontSize: 15,
    fontFamily: fonts.regular,
    lineHeight: 22,
  },
  notaComunitaria: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  notaTexto: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.gris,
    lineHeight: 18,
    textAlign: 'center',
  },
  actionButtons: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalButtonsStack: {
    gap: spacing.sm,
  },
});
