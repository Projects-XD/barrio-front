import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { AppButton } from '@/components/AppButton';
import { Chip } from '@/components/Chip';
import { OtroInput } from '@/components/OtroInput';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import {
  useDeleteProfile,
  useMyProfiles,
  useMySavedLocation,
  useProfile,
  useUpsertMyProfile,
  useVouch,
} from '@/hooks/useData';
import type { OficioCategory } from '@/types';
import { useAppStore } from '@/store/app-store';
import { oficioLabel } from '@/i18n/labels';
import { colors, fonts, radius, spacing } from '@/theme';
import { distanceMetersBetween } from '@/utils/geo';
import { shareOficioWhatsApp } from '@/utils/share';
import { AppModal } from '@/components/AppModal';

export default function OficioDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const { data: profile, isLoading, refetch } = useProfile(id);
  const { data: misOficios = [] } = useMyProfiles();
  const { data: savedLocation } = useMySavedLocation();
  const upsert = useUpsertMyProfile();
  const deleteProfile = useDeleteProfile();
  const [editando, setEditando] = useState(false);
  const [modoNuevo, setModoNuevo] = useState(false);
  const [menuOpciones, setMenuOpciones] = useState(false);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [modalExito, setModalExito] = useState(false);
  const [categoria, setCategoria] = useState<OficioCategory>('otro');
  const [otroOficio, setOtroOficio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [experiencia, setExperiencia] = useState('');
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
    } catch (err: unknown) {
      const errorMsg =
        (err instanceof Error && err.message) ||
        'No se pudo registrar el visto bueno. Recuerda que solo vecinos de la misma zona pueden validar un perfil.';
      Alert.alert('No se pudo otorgar el visto bueno', errorMsg);
    }
  };

  // nuevo = true: agregar otro oficio (categoría libre). nuevo = false: editar este oficio.
  const abrirEdicion = (nuevo: boolean) => {
    if (!profile) return;
    upsert.reset();
    setModoNuevo(nuevo);
    if (nuevo) {
      const usados = misOficios.map((o) => o.oficio.category);
      const libre = (Object.keys(oficioLabel) as OficioCategory[]).find((c) => !usados.includes(c)) ?? 'otro';
      setCategoria(libre);
      setDescripcion('');
      setExperiencia('0');
    } else {
      setCategoria(profile.oficio.category);
      setDescripcion(profile.description);
      setExperiencia(profile.yearsExperience ? String(profile.yearsExperience) : '0');
    }
    setEditando(true);
  };

  const guardarEdicion = () => {
    if (!profile) return;
    if (categoria === 'otro' && otroOficio.trim().length < 3) {
      Alert.alert('Escribe el oficio', 'Cuando eliges "Otro", escribe qué oficio es.');
      return;
    }
    if (modoNuevo && misOficios.some((o) => o.oficio.category === categoria)) {
      Alert.alert('Ya tienes ese oficio', 'Elige otra categoría o edita el oficio que ya tienes.');
      return;
    }
    upsert.mutate(
      {
        category: categoria,
        description:
          (categoria === 'otro' ? `Oficio: ${otroOficio.trim()}. ` : '') +
          (descripcion.trim() || 'Servicios para vecinos de la zona.'),
        yearsExperience: parseInt(experiencia, 10) || 0,
        existingId: modoNuevo ? undefined : profile.id,
      },
      {
        onSuccess: () => {
          setEditando(false);
          refetch();
          setModalExito(true);
        },
      }
    );
  };

  const confirmarEliminacion = () => {
    if (!profile || deleteProfile.isPending) return;
    deleteProfile.mutate(profile.id, {
      onSuccess: () => {
        setConfirmandoBaja(false);
        router.navigate('/(tabs)/perfil');
      },
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

  const distMeters =
    savedLocation && profile.location
      ? distanceMetersBetween({ lat: savedLocation.lat, lng: savedLocation.lng }, profile.location)
      : null;

  const stats = [
    {
      value: `${profile.validatedCount}`,
      label: profile.validatedCount === 1 ? 'Aval vecinal' : 'Avales vecinales',
    },
    ...(distMeters != null
      ? [
          {
            value: distMeters < 1000 ? `${Math.max(40, Math.round(distMeters / 10) * 10)} m` : `${(distMeters / 1000).toFixed(1)} km`,
            label: 'De tu ubicación',
          },
        ]
      : profile.distanceKm !== undefined
        ? [{ value: `${profile.distanceKm} km`, label: 'En tu zona' }]
        : []),
    ...(profile.yearsExperience
      ? [{ value: `${profile.yearsExperience} años`, label: 'Experiencia' }]
      : []),
  ];

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: 'Detalle de oficio',
          headerBackTitle: 'Volver',
        }}
      />

      {/* Tarjeta principal con jerarquía limpia */}
      <Card>
        <View style={styles.headerInfo}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Opciones del oficio"
            hitSlop={10}
            onPress={() => setMenuOpciones(true)}
            style={styles.cardMenuTrigger}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.azul} />
          </Pressable>
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
        {esMio ? (
          <AppButton
            label="Ir a mi perfil"
            variant="secondary"
            icon="person-outline"
            onPress={() => router.navigate('/(tabs)/perfil')}
          />
        ) : (
          <>
            <AppButton
              label="Contactar técnico"
              variant="accent"
              onPress={() => setShowContactModal(true)}
            />
            <AppButton
              label={
                profile.hasVouchedByMe
                  ? 'Visto bueno registrado'
                  : vouch.isPending
                    ? 'Registrando visto bueno...'
                    : 'Dar visto bueno'
              }
              variant="secondary"
              onPress={handleVouch}
              disabled={profile.hasVouchedByMe || vouch.isPending}
            />
          </>
        )}
      </View>

      {/* Formulario para editar mi oficio sin salir de esta pantalla */}
      <AppModal visible={editando} onClose={() => setEditando(false)} animationType="fade" overlayStyle={styles.modalOverlay} cardStyle={[styles.modalContent, { backgroundColor: colors.blanco, maxHeight: '88%' }]}>
                    <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.azul, flex: 1, textAlign: 'left', marginBottom: 0 }]}>
                {modoNuevo ? 'Agregar otro oficio' : 'Editar mi oficio'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancelar y cerrar"
                onPress={() => setEditando(false)}
                hitSlop={10}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.gris} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.campoLabel}>Tipo de oficio</Text>
              <View style={styles.chipsWrap}>
                {(Object.keys(oficioLabel) as OficioCategory[]).map((c) => (
                  <Chip key={c} label={oficioLabel[c]} selected={categoria === c} onPress={() => setCategoria(c)} />
                ))}
              </View>

              {categoria === 'otro' ? (
                <OtroInput
                  label="Escribe qué oficio es"
                  value={otroOficio}
                  onChangeText={setOtroOficio}
                  placeholder="Ej: Tapicero"
                />
              ) : null}

              <Text style={styles.campoLabel}>Años de experiencia</Text>
              <TextInput
                value={experiencia}
                onChangeText={setExperiencia}
                keyboardType="numeric"
                placeholder="Ej. 5"
                placeholderTextColor={colors.gris}
                style={styles.campoInput}
              />

              <Text style={styles.campoLabel}>Descripción del servicio</Text>
              <TextInput
                value={descripcion}
                onChangeText={setDescripcion}
                placeholder="Qué trabajos haces y cómo ayudas a tus vecinos"
                placeholderTextColor={colors.gris}
                multiline
                style={[styles.campoInput, styles.campoArea]}
              />

              {upsert.error ? (
                <Text style={styles.errorTexto}>No se pudo guardar: {upsert.error.message}</Text>
              ) : null}

              <View style={{ marginTop: spacing.md }}>
                <AppButton
                  label={upsert.isPending ? 'Guardando...' : 'Guardar cambios'}
                  variant="accent"
                  onPress={guardarEdicion}
                  disabled={upsert.isPending}
                />
                <AppButton
                  label="Cancelar"
                  variant="secondary"
                  disabled={upsert.isPending}
                  onPress={() => setEditando(false)}
                />
              </View>
            </ScrollView>
      </AppModal>

      {/* Modal de opciones de contacto vecinal */}
      <AppModal visible={showContactModal} onClose={() => setShowContactModal(false)} animationType="fade" overlayStyle={styles.modalOverlay} cardStyle={[styles.modalContent, { backgroundColor: colors.blanco }]}>
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
      </AppModal>

      {/* Menú contextual (⋮) de opciones del oficio */}
      <AppModal visible={menuOpciones} onClose={() => setMenuOpciones(false)} animationType="fade" overlayStyle={styles.modalOverlay} cardStyle={[styles.modalContent, { backgroundColor: colors.blanco }]}>
                    <Text style={[styles.modalTitle, { color: p.text }]}>{oficioLabel[profile.oficio.category]}</Text>
            <Text style={[styles.modalSubtitle, { color: p.muted }]}>
              {esMio ? 'Opciones de tu oficio' : 'Opciones del oficio'}
            </Text>

            {esMio ? (
              <>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMenuOpciones(false);
                abrirEdicion(false);
              }}
              style={styles.contextActionRow}
            >
              <Ionicons name="create-outline" size={20} color={colors.azul} />
              <Text style={[styles.contextActionText, { color: p.text }]}>Editar este oficio</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMenuOpciones(false);
                deleteProfile.reset();
                setConfirmandoBaja(true);
              }}
              style={styles.contextActionRow}
            >
              <Ionicons name="trash-outline" size={20} color={colors.rojo} />
              <Text style={[styles.contextActionText, { color: colors.rojo }]}>Eliminar este oficio</Text>
            </Pressable>
              </>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMenuOpciones(false);
                shareOficioWhatsApp(profile);
              }}
              style={styles.contextActionRow}
            >
              <Ionicons name="logo-whatsapp" size={20} color={colors.azul} />
              <Text style={[styles.contextActionText, { color: p.text }]}>
                {esMio ? 'Compartir mi oficio en WhatsApp' : 'Recomendar en WhatsApp del barrio'}
              </Text>
            </Pressable>

            <View style={{ marginTop: spacing.xs }}>
              <AppButton label="Cancelar" variant="secondary" onPress={() => setMenuOpciones(false)} />
            </View>
      </AppModal>

      {/* Modal para confirmar eliminación de oficio */}
      <AppModal visible={confirmandoBaja} onClose={() => setConfirmandoBaja(false)} animationType="fade" overlayStyle={styles.modalOverlay} cardStyle={[styles.modalContent, { backgroundColor: colors.blanco }]}>
                    <Text style={[styles.modalTitle, { color: p.text }]}>¿Eliminar este oficio?</Text>
            <Text style={[styles.modalSubtitle, { color: p.muted }]}>
              Se quitará {oficioLabel[profile.oficio.category]} de tu perfil y del directorio del barrio.
            </Text>
            {deleteProfile.error ? (
              <Text style={styles.errorTexto}>
                No se pudo eliminar: {(deleteProfile.error as Error).message}
              </Text>
            ) : null}
            <View style={styles.modalButtonsStack}>
              <AppButton
                label={deleteProfile.isPending ? 'Eliminando...' : 'Sí, eliminar oficio'}
                variant="danger"
                icon="trash-outline"
                disabled={deleteProfile.isPending}
                onPress={confirmarEliminacion}
              />
              <AppButton
                label="Cancelar"
                variant="secondary"
                disabled={deleteProfile.isPending}
                onPress={() => setConfirmandoBaja(false)}
              />
            </View>
      </AppModal>

      {/* Modal de éxito tras guardar oficio */}
      <Modal
        visible={modalExito}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setModalExito(false);
          router.navigate('/(tabs)/perfil');
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setModalExito(false);
              router.navigate('/(tabs)/perfil');
            }}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.blanco }]}>
            <Text style={[styles.modalTitle, { color: p.text }]}>¡Oficio guardado!</Text>
            <Text style={[styles.modalSubtitle, { color: p.muted }]}>
              Los datos de tu oficio se actualizaron correctamente en el barrio.
            </Text>
            <AppButton
              label="Ir a mi perfil"
              variant="accent"
              icon="person-outline"
              onPress={() => {
                setModalExito(false);
                router.navigate('/(tabs)/perfil');
              }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  campoLabel: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.azul, marginTop: spacing.sm, marginBottom: 6 },
  campoInput: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: colors.grisBorde,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.azul,
    backgroundColor: colors.blanco,
    marginBottom: spacing.xs,
  },
  campoArea: { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs },
  errorTexto: { fontFamily: fonts.medium, fontSize: 14, color: colors.rojo, marginTop: spacing.xs },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: spacing.xl },
  headerInfo: {
    alignItems: 'center',
    marginBottom: spacing.md,
    position: 'relative',
  },
  cardMenuTrigger: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fondo,
  },
  contextActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radius.md,
  },
  contextActionText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
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
    fontFamily: fonts.section,
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
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fondo,
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
