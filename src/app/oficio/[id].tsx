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
import { ValidationBadge } from '@/components/ValidationBadge';
import { usePalette } from '@/hooks/usePalette';
import { useProfile, useVouch } from '@/hooks/useData';
import { oficioLabel } from '@/i18n/labels';
import { colors, fonts, radius, spacing } from '@/theme';

export default function OficioDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const { data: profile, isLoading } = useProfile(id);
  const vouch = useVouch(id);
  const [showContactModal, setShowContactModal] = useState(false);

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
        <EmptyState title="Perfil no encontrado" message="Puede que este oficio ya no esté disponible." />
      </Screen>
    );
  }

  const initials = profile.user.fullName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

  const handleCall = () => {
    setShowContactModal(false);
    Linking.openURL('tel:+51987654321').catch(() => {
      Alert.alert('Contacto', 'Teléfono del profesional: +51 987 654 321');
    });
  };

  const handleWhatsApp = () => {
    setShowContactModal(false);
    const msg = encodeURIComponent(
      `Hola ${profile.user.fullName}, vi tu perfil de ${oficioLabel[profile.oficio.category]} en la app Barrio.`
    );
    Linking.openURL(`https://wa.me/51987654321?text=${msg}`).catch(() => {
      Alert.alert('WhatsApp', 'No se pudo abrir WhatsApp.');
    });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: profile.user.fullName }} />

      <Card>
        <View style={styles.headerRow}>
          <View style={[styles.avatar, { backgroundColor: colors.azul }]}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.nombre, { color: p.text }]}>{profile.user.fullName}</Text>
            <Text style={[styles.sub, { color: p.muted }]}>
              {`${oficioLabel[profile.oficio.category]}${profile.yearsExperience ? ` · ${profile.yearsExperience} años de exp.` : ''}`}
            </Text>
            {profile.distanceKm !== undefined ? (
              <Text style={[styles.distancia, { color: colors.gris }]}>
                📍 Aprox. a {profile.distanceKm} km de tu ubicación
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.badgeWrapper}>
          <ValidationBadge validatedCount={profile.validatedCount} />
        </View>

        <View style={styles.divider} />

        <Text style={[styles.seccionTitulo, { color: p.text }]}>Sobre este servicio</Text>
        <Text style={[styles.descripcion, { color: colors.texto }]}>{profile.description}</Text>
      </Card>

      <View style={styles.reglaCard}>
        <Text style={styles.reglaTitulo}>💡 ¿Cómo funciona el visto bueno?</Text>
        <Text style={styles.reglaTexto}>
          Solo vecinos de la misma zona pueden dar su visto bueno. Al sumar 2 o más recomendaciones, el profesional obtiene la insignia oficial de Validado.
        </Text>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <AppButton
          label={
            profile.hasVouchedByMe
              ? '✓ Ya diste tu visto bueno'
              : vouch.isPending
                ? 'Registrando visto bueno...'
                : 'Dar visto bueno vecinal'
          }
          variant={profile.hasVouchedByMe ? 'secondary' : 'accent'}
          onPress={() => vouch.mutate()}
          disabled={profile.hasVouchedByMe || vouch.isPending}
        />
        <AppButton
          label="Llamar o contactar"
          variant="secondary"
          onPress={() => setShowContactModal(true)}
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
          <View style={[styles.modalContent, { backgroundColor: colors.blanco }]}>
            <Text style={[styles.modalTitle, { color: p.text }]}>Contactar a {profile.user.fullName}</Text>
            <Text style={[styles.modalSub, { color: p.muted }]}>
              Comunícate de vecino a vecino para coordinar el trabajo:
            </Text>

            <View style={styles.modalButtons}>
              <AppButton
                label="📞 Llamar por teléfono"
                variant="primary"
                onPress={handleCall}
              />
              <AppButton
                label="💬 Enviar WhatsApp"
                variant="accent"
                onPress={handleWhatsApp}
              />
              <AppButton
                label="Cancelar"
                variant="link"
                onPress={() => setShowContactModal(false)}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: spacing.sm },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.blanco, fontFamily: fonts.bold, fontSize: 20 },
  headerInfo: { flex: 1 },
  nombre: { fontSize: 22, fontFamily: fonts.bold, marginBottom: 2 },
  sub: { fontSize: 15, fontFamily: fonts.medium },
  distancia: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },
  badgeWrapper: { marginVertical: 8 },
  divider: { height: 1, backgroundColor: colors.grisBorde, marginVertical: spacing.md },
  seccionTitulo: { fontSize: 16, fontFamily: fonts.semiBold, marginBottom: 6 },
  descripcion: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 24 },
  reglaCard: {
    backgroundColor: '#E0ECFB',
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BDD7F5',
    marginVertical: spacing.sm,
  },
  reglaTitulo: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.azul, marginBottom: 4 },
  reglaTexto: { fontSize: 13, fontFamily: fonts.regular, color: colors.carbon, lineHeight: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 46, 102, 0.4)',
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
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
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
  },
});
