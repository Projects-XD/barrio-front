import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useProfile, useRemoveVouch, useVouch } from '@/hooks/useData';
import { oficioLabel } from '@/i18n/labels';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, radius, spacing } from '@/theme';

export default function OficioDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const userId = useAppStore((s) => s.userId);
  const zoneName = useAppStore((s) => s.zoneName) || 'Castilla';
  const { data: profile, isLoading, refetch } = useProfile(id);
  const vouch = useVouch(id);
  const removeVouch = useRemoveVouch(id);

  const [showContactModal, setShowContactModal] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleToggleVouch = async () => {
    if (!profile) return;
    setFeedback(null);

    try {
      if (profile.hasVouchedByMe) {
        await removeVouch.mutateAsync();
        setFeedback({
          type: 'success',
          text: `Retiraste tu visto bueno del perfil de ${profile.user.fullName}.`,
        });
      } else {
        await vouch.mutateAsync();
        setFeedback({
          type: 'success',
          text: `¡Visto bueno registrado! Has respaldado el oficio de ${profile.user.fullName} en tu zona.`,
        });
      }
    } catch (err: any) {
      const errorMsg =
        err?.message ||
        'No se pudo procesar el visto bueno. Recuerda que solo vecinos de la misma zona pueden validar un perfil.';
      setFeedback({
        type: 'error',
        text: errorMsg,
      });
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
        <EmptyState
          title="Perfil no disponible"
          message="Este perfil no se encuentra en tu zona o no pudo cargarse."
        />
        <View style={styles.actionButtons}>
          <AppButton label="Reintentar" variant="accent" onPress={() => refetch()} />
          <AppButton
            label="Volver al directorio de oficios"
            variant="secondary"
            onPress={() => router.replace('/(tabs)/oficios')}
          />
        </View>
      </Screen>
    );
  }

  const esMio = profile.userId === userId;
  const isVouchLoading = vouch.isPending || removeVouch.isPending;

  const handleWhatsApp = () => {
    setShowContactModal(false);
    const msg = encodeURIComponent(
      `Hola ${profile.user.fullName}, vi tu perfil de ${oficioLabel[profile.oficio.category]} en la app Barrio (${zoneName}) y quisiera consultar por tus servicios.`
    );
    Linking.openURL(`https://wa.me/?text=${msg}`).catch(() => {
      setFeedback({
        type: 'error',
        text: 'No se pudo abrir WhatsApp en este dispositivo.',
      });
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

      {/* Mensaje de confirmación o error inline (visible tanto en Web como en Móvil) */}
      {feedback ? (
        <View
          style={[
            styles.feedbackBox,
            feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
          ]}
        >
          <Text
            style={[
              styles.feedbackText,
              { color: feedback.type === 'success' ? colors.azul : '#991B1B' },
            ]}
          >
            {feedback.text}
          </Text>
        </View>
      ) : null}

      {/* Nota comunitaria sutil y humana */}
      <View style={styles.notaComunitaria}>
        <Text style={styles.notaTexto}>
          {profile.validatedCount >= 2
            ? `Perfil validado con visto bueno de vecinos de ${zoneName}. Las recomendaciones son otorgadas únicamente por residentes de la misma zona.`
            : `Este oficio cuenta con ${profile.validatedCount} de 2 vistos buenos requeridos por vecinos de ${zoneName} para su validación comunitaria.`}
        </Text>
      </View>

      {/* Botones de acción con jerarquía y colores claramente diferenciados */}
      {esMio ? (
        <View style={styles.actionButtons}>
          <AppButton
            label="Editar mi oficio en Perfil"
            variant="accent"
            onPress={() => router.push('/(tabs)/perfil')}
          />
          <AppButton
            label="Volver a oficios"
            variant="secondary"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(tabs)/oficios')
            }
          />
        </View>
      ) : (
        <View style={styles.actionButtons}>
          <AppButton
            label="Contactar técnico"
            variant="accent"
            onPress={() => setShowContactModal(true)}
          />
          <AppButton
            label={
              isVouchLoading
                ? 'Procesando visto bueno...'
                : profile.hasVouchedByMe
                  ? 'Visto bueno otorgado · Retirar'
                  : 'Dar visto bueno'
            }
            variant="secondary"
            onPress={handleToggleVouch}
            disabled={isVouchLoading}
          />
        </View>
      )}

      {/* Modal de opciones de contacto vecinal */}
      <Modal
        visible={showContactModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContactModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowContactModal(false)}>
          <Pressable
            onPress={() => {}}
            style={[styles.modalContent, { backgroundColor: colors.blanco }]}
          >
            <Text style={[styles.modalTitle, { color: p.text }]}>
              Contactar a {profile.user.fullName}
            </Text>
            <Text style={[styles.modalSub, { color: p.muted }]}>
              Abre WhatsApp con un mensaje listo para consultar disponibilidad y presupuesto.
            </Text>

            <View style={styles.modalButtons}>
              <AppButton
                label="Enviar mensaje por WhatsApp"
                variant="accent"
                onPress={handleWhatsApp}
              />
              <AppButton
                label="Cancelar"
                variant="link"
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
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  headerInfo: {
    marginBottom: spacing.xs,
  },
  nombre: {
    fontSize: 22,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
  },
  oficio: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.azul,
    marginTop: 2,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  statColWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#E2E8F0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.azul,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13.5,
    fontFamily: fonts.medium,
    color: '#64748B',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: spacing.md,
  },
  seccionTitulo: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    marginBottom: 6,
  },
  descripcion: {
    fontSize: 15,
    fontFamily: fonts.regular,
    lineHeight: 22,
    color: '#334155',
  },
  feedbackBox: {
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  feedbackSuccess: {
    backgroundColor: '#EEF5FD',
    borderColor: '#BFDBFE',
  },
  feedbackError: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  feedbackText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  notaComunitaria: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: spacing.sm,
  },
  notaTexto: {
    fontSize: 13.5,
    fontFamily: fonts.regular,
    color: '#64748B',
    lineHeight: 19,
    textAlign: 'center',
  },
  actionButtons: {
    marginTop: spacing.md,
    gap: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 46, 102, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.grisBorde,
    shadowColor: '#132E66',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalTitle: {
    fontSize: 19,
    fontFamily: fonts.bold,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 14,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  modalButtons: {
    marginTop: spacing.xs,
    gap: 8,
  },
});
