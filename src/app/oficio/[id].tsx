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
import { Ionicons } from '@expo/vector-icons';
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
        <EmptyState title="Perfil no disponible" message="Este perfil no se encuentra en tu zona." />
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
      Alert.alert('Contacto telefónico', 'Teléfono: +51 987 654 321');
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
          <View style={[styles.avatar, { backgroundColor: '#EBF3FC', borderColor: '#D0E3F8' }]}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.nombre, { color: p.text }]}>{profile.user.fullName}</Text>
            <Text style={[styles.sub, { color: p.muted }]}>
              {`${oficioLabel[profile.oficio.category]}${profile.yearsExperience ? ` · ${profile.yearsExperience} años exp.` : ''}`}
            </Text>
            {profile.distanceKm !== undefined ? (
              <View style={styles.distanciaRow}>
                <Ionicons name="location-outline" size={13} color={colors.gris} />
                <Text style={[styles.distancia, { color: colors.gris }]}>
                  {profile.distanceKm} km en tu zona
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.badgeWrapper}>
          <ValidationBadge validatedCount={profile.validatedCount} />
        </View>

        <View style={styles.divider} />

        <Text style={[styles.seccionTitulo, { color: p.text }]}>Servicio y especialidad</Text>
        <Text style={[styles.descripcion, { color: colors.texto }]}>{profile.description}</Text>
      </Card>

      <View style={styles.reglaCard}>
        <View style={styles.reglaHeader}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.azul} />
          <Text style={styles.reglaTitulo}>Garantía comunitaria</Text>
        </View>
        <Text style={styles.reglaTexto}>
          Solo vecinos de la misma zona pueden otorgar avales. Al sumar 2 o más recomendaciones, el perfil queda oficialmente validado.
        </Text>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <AppButton
          label={
            profile.hasVouchedByMe
              ? 'Aval registrado'
              : vouch.isPending
                ? 'Registrando aval...'
                : 'Dar visto bueno'
          }
          variant={profile.hasVouchedByMe ? 'secondary' : 'accent'}
          onPress={() => vouch.mutate()}
          disabled={profile.hasVouchedByMe || vouch.isPending}
        />
        <AppButton
          label="Contactar técnico"
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
              Coordina el servicio directamente con tu vecino:
            </Text>

            <View style={styles.modalButtons}>
              <AppButton
                label="Llamar por teléfono"
                variant="primary"
                onPress={handleCall}
              />
              <AppButton
                label="Enviar WhatsApp"
                variant="accent"
                onPress={handleWhatsApp}
              />
              <AppButton
                label="Cerrar"
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
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  initials: { color: colors.azul, fontFamily: fonts.bold, fontSize: 18 },
  headerInfo: { flex: 1 },
  nombre: { fontSize: 20, fontFamily: fonts.bold, marginBottom: 2 },
  sub: { fontSize: 14, fontFamily: fonts.medium },
  distanciaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  distancia: { fontSize: 13, fontFamily: fonts.regular },
  badgeWrapper: { marginVertical: 6 },
  divider: { height: 1, backgroundColor: colors.grisBorde, marginVertical: spacing.md },
  seccionTitulo: { fontSize: 15, fontFamily: fonts.semiBold, marginBottom: 6 },
  descripcion: { fontSize: 15, fontFamily: fonts.regular, lineHeight: 22 },
  reglaCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.grisBorde,
    marginVertical: spacing.sm,
  },
  reglaHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  reglaTitulo: { fontSize: 13.5, fontFamily: fonts.semiBold, color: colors.azul },
  reglaTexto: { fontSize: 13, fontFamily: fonts.regular, color: colors.gris, lineHeight: 18 },
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
  },
});
