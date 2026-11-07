import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useExpressInterest, useFavor, useUpdateFavor } from '@/hooks/useData';
import { favorStatusLabel, favorTypeLabel, syncStatusLabel } from '@/i18n/labels';
import { useAppStore } from '@/store/app-store';
import type { FavorStatus } from '@/types';
import { colors, fonts, radius, spacing } from '@/theme';

export default function FavorDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const userId = useAppStore((s) => s.userId);
  const { data: favor, isLoading, isError, error, refetch } = useFavor(id);
  const interes = useExpressInterest(id);
  const actualizarFavor = useUpdateFavor(id);

  const [mensaje, setMensaje] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleBackToFavores = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/favores');
    }
  };

  const handleInteres = async () => {
    setFeedback(null);
    try {
      await interes.mutateAsync(mensaje.trim() ? mensaje.trim() : undefined);
      setMensaje('');
      setFeedback({
        type: 'success',
        text: '¡Listo! Le avisamos a tu vecino que puedes ayudarle con este favor.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: (err as Error)?.message ?? 'No se pudo registrar tu interés.',
      });
    }
  };

  const handleStatusChange = async (newStatus: FavorStatus) => {
    setFeedback(null);
    try {
      await actualizarFavor.mutateAsync({ status: newStatus });
      if (newStatus === 'cerrada' || newStatus === 'cancelada') {
        router.replace('/(tabs)/favores');
      } else {
        setFeedback({
          type: 'success',
          text: `El estado del favor se actualizó a "${favorStatusLabel[newStatus]}".`,
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: (err as Error)?.message ?? 'No se pudo actualizar el estado del favor.',
      });
    }
  };

  const handleWhatsApp = (targetName: string, favorTitle: string) => {
    const msg = encodeURIComponent(
      `Hola ${targetName}, vi tu favor "${favorTitle}" en la app Barrio y me gustaría ayudarte.`
    );
    Linking.openURL(`https://wa.me/?text=${msg}`).catch(() => {
      setFeedback({
        type: 'error',
        text: 'No se pudo abrir WhatsApp en este dispositivo.',
      });
    });
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

  if (isError || !favor) {
    return (
      <Screen>
        <EmptyState
          title="No pudimos abrir este favor"
          message={(error as Error)?.message ?? 'Puede que ya no esté disponible en tu zona.'}
        />
        <View style={styles.actionButtons}>
          <AppButton label="Reintentar" variant="accent" onPress={() => refetch()} />
          <AppButton
            label="Volver al muro de favores"
            variant="secondary"
            onPress={() => router.replace('/(tabs)/favores')}
          />
        </View>
      </Screen>
    );
  }

  const esMio = favor.authorId === userId || favor.authorId === 'me';
  const abierto = favor.status === 'abierta' || favor.status === 'en_curso';
  const isPendingSync = favor.syncStatus !== 'enviado';
  const interestsList = favor.interests ?? [];

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Detalle del favor', headerBackTitle: 'Volver' }} />

      {/* Tarjeta principal con jerarquía editorial limpia */}
      <Card>
        <View style={styles.topRow}>
          <Text style={styles.tipo}>{favorTypeLabel[favor.type]}</Text>
          <View
            style={[
              styles.statusBadge,
              isPendingSync ? styles.statusPending : styles.statusActive,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                { color: isPendingSync ? '#8A5A00' : colors.azul },
              ]}
            >
              {isPendingSync
                ? syncStatusLabel[favor.syncStatus]
                : favorStatusLabel[favor.status]}
            </Text>
          </View>
        </View>

        <Text style={[styles.titulo, { color: p.text }]}>{favor.title}</Text>

        {favor.description ? (
          <Text style={styles.descripcion}>{favor.description}</Text>
        ) : null}

        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {esMio ? 'Tú' : favor.author.fullName}
            </Text>
            <Text style={styles.statLabel}>Publicado por</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{favor.interestedCount}</Text>
            <Text style={styles.statLabel}>
              {favor.interestedCount === 1
                ? 'Vecino interesado'
                : 'Vecinos interesados'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Mensaje de confirmación o error inline */}
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

      {/* Vista según si soy el autor o un vecino solidario */}
      {esMio ? (
        <View style={styles.authorSection}>
          <Text style={[styles.sectionTitle, { color: p.text }]}>
            Vecinos que ofrecieron su ayuda ({interestsList.length})
          </Text>

          {interestsList.length > 0 ? (
            interestsList.map((item) => (
              <Card key={item.id}>
                <Text style={[styles.helperName, { color: p.text }]}>
                  {item.userName}
                </Text>
                <Text style={styles.helperMsg}>
                  {item.message || 'Ofreció ayudarte con este favor.'}
                </Text>
                <View style={{ marginTop: spacing.xs }}>
                  <AppButton
                    label={`Coordinar con ${item.userName.split(' ')[0]} por WhatsApp`}
                    variant="secondary"
                    onPress={() => handleWhatsApp(item.userName, favor.title)}
                  />
                </View>
              </Card>
            ))
          ) : (
            <View style={styles.infoNote}>
              <Text style={styles.infoNoteText}>
                {isPendingSync
                  ? 'Este favor está guardado en tu dispositivo y se publicará apenas vuelva la conexión.'
                  : 'Aún no hay vecinos postulados, pero tu favor ya es visible en el muro de tu zona.'}
              </Text>
            </View>
          )}

          {!isPendingSync && abierto ? (
            <View style={styles.actionButtons}>
              {favor.status === 'abierta' ? (
                <AppButton
                  label={
                    actualizarFavor.isPending
                      ? 'Actualizando...'
                      : 'Marcar favor en curso'
                  }
                  variant="accent"
                  onPress={() => handleStatusChange('en_curso')}
                  disabled={actualizarFavor.isPending}
                />
              ) : null}
              <AppButton
                label={
                  actualizarFavor.isPending
                    ? 'Actualizando...'
                    : 'Marcar favor como resuelto'
                }
                variant={favor.status === 'en_curso' ? 'accent' : 'secondary'}
                onPress={() => handleStatusChange('cerrada')}
                disabled={actualizarFavor.isPending}
              />
              <AppButton
                label="Volver al muro de favores"
                variant="link"
                onPress={handleBackToFavores}
              />
            </View>
          ) : (
            <View style={styles.actionButtons}>
              <AppButton
                label="Volver al muro de favores"
                variant="secondary"
                onPress={handleBackToFavores}
              />
            </View>
          )}
        </View>
      ) : favor.hasInterestedByMe ? (
        <View style={styles.actionButtons}>
          <View style={styles.infoNote}>
            <Text style={styles.infoNoteText}>
              Ya ofreciste tu apoyo a {favor.author.fullName}. Puedes escribirle directamente para coordinar.
            </Text>
          </View>
          <AppButton
            label={`Contactar a ${favor.author.fullName.split(' ')[0]} por WhatsApp`}
            variant="accent"
            onPress={() => handleWhatsApp(favor.author.fullName, favor.title)}
          />
          <AppButton
            label="Volver al muro de favores"
            variant="secondary"
            onPress={handleBackToFavores}
          />
        </View>
      ) : abierto ? (
        <View style={styles.helperForm}>
          <Card>
            <Text style={[styles.sectionTitle, { color: p.text, marginTop: 0 }]}>
              ¿Puedes ayudar a {favor.author.fullName}?
            </Text>
            <Text style={styles.helperSub}>
              Déjale un mensaje breve opcional para coordinar cómo ayudarle.
            </Text>
            <TextInput
              value={mensaje}
              onChangeText={setMensaje}
              placeholder="Ej: Hola vecino, yo tengo lo que necesitas y paso a las 5pm..."
              placeholderTextColor={colors.gris}
              multiline
              maxLength={300}
              style={[
                styles.input,
                { borderColor: p.border, color: p.text, backgroundColor: colors.blanco },
              ]}
            />
          </Card>

          <View style={styles.actionButtons}>
            <AppButton
              label={interes.isPending ? 'Enviando...' : 'Me interesa, puedo ayudar'}
              variant="accent"
              onPress={handleInteres}
              disabled={interes.isPending}
            />
            <AppButton
              label="Volver al muro de favores"
              variant="secondary"
              onPress={handleBackToFavores}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actionButtons}>
          <View style={styles.infoNote}>
            <Text style={styles.infoNoteText}>
              Este favor ya fue resuelto o cerrado por el vecino.
            </Text>
          </View>
          <AppButton
            label="Volver al muro de favores"
            variant="secondary"
            onPress={handleBackToFavores}
          />
        </View>
      )}
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tipo: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.azul,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: '#EEF5FD',
    borderColor: '#D0E3F8',
  },
  statusPending: {
    backgroundColor: '#FFF3DC',
    borderColor: '#FDE68A',
  },
  statusBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  titulo: {
    fontFamily: fonts.bold,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.2,
  },
  descripcion: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#334155',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginTop: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.azul,
    marginBottom: 2,
    textAlign: 'center',
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#64748B',
  },
  feedbackBox: {
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    marginBottom: spacing.sm,
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
  authorSection: {
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  helperName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    marginBottom: 4,
  },
  helperMsg: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
    color: '#334155',
    lineHeight: 20,
  },
  helperForm: {
    marginTop: spacing.xs,
  },
  helperSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#64748B',
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  input: {
    minHeight: 84,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 15,
    fontFamily: fonts.regular,
    textAlignVertical: 'top',
  },
  infoNote: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: spacing.xs,
  },
  infoNoteText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    textAlign: 'center',
  },
  actionButtons: {
    marginTop: spacing.sm,
    gap: 10,
  },
});
