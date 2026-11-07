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
import * as Linking from 'expo-linking';
import { AppButton } from '@/components/AppButton';
import { Chip } from '@/components/Chip';
import { OtroInput } from '@/components/OtroInput';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useMyProfiles, useProfile, useUpsertMyProfile, useVouch } from '@/hooks/useData';
import type { OficioCategory } from '@/types';
import { useAppStore } from '@/store/app-store';
import { oficioLabel } from '@/i18n/labels';
import { colors, fonts, radius, spacing } from '@/theme';

export default function OficioDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const { data: profile, isLoading, refetch } = useProfile(id);
  const { data: misOficios = [] } = useMyProfiles();
  const upsert = useUpsertMyProfile();
  const [editando, setEditando] = useState(false);
  const [modoNuevo, setModoNuevo] = useState(false);
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
    } catch (err: any) {
      const errorMsg =
        err?.message ||
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
          if (modoNuevo) {
            router.replace('/(tabs)/perfil');
          } else {
            refetch();
          }
        },
      }
    );
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

  // Los perfiles aún no guardan teléfono: se abre WhatsApp con el mensaje listo para elegir el contacto.
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

        {/* Barra de métricas tipográfica (sin iconos genéricos) */}
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

      {/* Nota comunitaria sutil y humana (sin cajas ni escudos genéricos) */}
      <View style={styles.notaComunitaria}>
        <Text style={styles.notaTexto}>
          {profile.validatedCount >= 2
            ? 'Perfil validado con visto bueno de vecinos de Castilla. Las recomendaciones son otorgadas únicamente por residentes de la misma zona.'
            : 'Este oficio necesita 2 vistos buenos de vecinos de Castilla para considerarse oficialmente validado.'}
        </Text>
      </View>

      {/* Botones de acción con jerarquía y colores diferenciados */}
      <View style={styles.actionButtons}>
        {esMio ? (
          <>
            <AppButton label="Editar mi oficio" variant="accent" onPress={() => abrirEdicion(false)} />
            <AppButton label="Agregar otro oficio" variant="secondary" onPress={() => abrirEdicion(true)} />
          </>
        ) : null}
        {esMio ? null : (
        <>
        <AppButton
          label="Contactar técnico"
          variant="accent"
          onPress={() => setShowContactModal(true)}
        />
        <AppButton
          label={
            esMio || profile.hasVouchedByMe
              ? (esMio ? 'Es tu oficio' : 'Visto bueno registrado')
              : vouch.isPending
                ? 'Registrando visto bueno...'
                : 'Dar visto bueno'
          }
          variant="secondary"
          onPress={handleVouch}
          disabled={esMio || profile.hasVouchedByMe || vouch.isPending}
        />
      
        </>
        )}
      </View>

      {/* Formulario para editar mi oficio sin salir de esta pantalla */}
      <Modal visible={editando} transparent animationType="fade" onRequestClose={() => setEditando(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditando(false)}>
          <Pressable onPress={() => {}} style={[styles.modalContent, { backgroundColor: colors.blanco, maxHeight: '85%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: colors.azul }]}>
                {modoNuevo ? 'Agregar otro oficio' : 'Editar mi oficio'}
              </Text>

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
                <AppButton label="Cancelar" variant="link" onPress={() => setEditando(false)} />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

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
            <Text style={[styles.modalSub, { color: p.muted }]}>
              Abre WhatsApp con un mensaje listo y elige el contacto de tu vecino.
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
    fontSize: 14,
    fontFamily: fonts.medium,
    color: '#64748B',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: spacing.md,
  },
  seccionTitulo: {
    fontSize: 14.5,
    fontFamily: fonts.semiBold,
    marginBottom: 6,
  },
  descripcion: {
    fontSize: 14.5,
    fontFamily: fonts.regular,
    lineHeight: 22,
    color: '#334155',
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
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#64748B',
    lineHeight: 18,
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
  },
});
