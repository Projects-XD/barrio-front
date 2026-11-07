import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { OtroInput } from '@/components/OtroInput';
import { Screen } from '@/components/Screen';
import { ToggleRow } from '@/components/ToggleRow';
import { ValidationBadge } from '@/components/ValidationBadge';
import { supabase } from '@/lib/supabase';
import { usePalette } from '@/hooks/usePalette';
import { useAppStore } from '@/store/app-store';
import * as ImagePicker from 'expo-image-picker';
import {
  useDeleteProfile,
  useFavors,
  useMyAvatarUrl,
  useMyProfile,
  useMyProfiles,
  useMySavedLocation,
  useUpdateAvatar,
  useUpsertMyProfile,
  useZones,
} from '@/hooks/useData';
import { oficioIcon } from '@/i18n/icons';
import { oficioLabel } from '@/i18n/labels';
import type { OficioCategory, ProfessionalProfile } from '@/types';
import { colors, fonts, radius, spacing } from '@/theme';

const categorias = Object.keys(oficioLabel) as OficioCategory[];

// Oculto para la demo final. Pon en __DEV__ para recuperar los interruptores de prueba.
const SHOW_DEMO_TOOLS = false;

export default function Perfil() {
  const p = usePalette();
  const simulatedEmergency = useAppStore((s) => s.simulatedEmergency);
  const serverEmergency = useAppStore((s) => s.serverEmergency);
  const setSimulatedEmergency = useAppStore((s) => s.setSimulatedEmergency);
  const isOnline = useAppStore((s) => s.isOnline);
  const setOnline = useAppStore((s) => s.setOnline);
  const clearSession = useAppStore((s) => s.clearSession);
  const userId = useAppStore((s) => s.userId);
  const zoneId = useAppStore((s) => s.zoneId);
  const userFullName = useAppStore((s) => s.userFullName) || 'Vecino';
  const userEmail = useAppStore((s) => s.userEmail);

  const { data: zonas = [] } = useZones();
  const zonaActual = zonas.find((z) => z.id === zoneId);
  const nombreZona = zonaActual ? `${zonaActual.name}, ${zonaActual.city}` : 'Castilla, Piura';

  const { data: myProfile } = useMyProfile();
  const { data: misOficios = [], isPending: cargandoOficios } = useMyProfiles();
  const { data: savedLocation } = useMySavedLocation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOficio, setMenuOficio] = useState<ProfessionalProfile | null>(null);
  const [confirmDeleteOficio, setConfirmDeleteOficio] = useState<ProfessionalProfile | null>(null);
  const [exitoOficioMsg, setExitoOficioMsg] = useState<string | null>(null);
  const { data: favors = [] } = useFavors();
  const misFavores = favors.filter((f) => f.authorId === userId).length;
  const totalVistosBuenos = misOficios.reduce((acc, o) => acc + (o.validatedCount ?? 0), 0);
  const upsertProfile = useUpsertMyProfile();
  const deleteProfile = useDeleteProfile();
  const { data: avatarUrl } = useMyAvatarUrl();
  const updateAvatar = useUpdateAvatar();

  const cambiarFoto = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Sin permiso', 'Activa el acceso a tus fotos para cambiar tu foto de perfil.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (res.canceled || !res.assets[0]) return;
    try {
      await updateAvatar.mutateAsync(res.assets[0].uri);
    } catch (err) {
      Alert.alert('No se pudo guardar la foto', (err as Error).message);
    }
  };

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCat, setSelectedCat] = useState<OficioCategory>(
    myProfile?.oficio.category ?? 'gasfiteria'
  );
  const [descripcion, setDescripcion] = useState(myProfile?.description ?? '');
  const [experiencia, setExperiencia] = useState(
    myProfile?.yearsExperience ? String(myProfile.yearsExperience) : '2'
  );
  const [otroOficio, setOtroOficio] = useState('');

  const initials = userFullName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleOpenModal = (oficio: ProfessionalProfile | null) => {
    upsertProfile.reset();
    setMenuOficio(null);
    setEditingId(oficio?.id ?? null);
    const usados = misOficios.map((o) => o.oficio.category);
    const libre = categorias.find((c) => !usados.includes(c)) ?? 'otro';
    setSelectedCat(oficio ? oficio.oficio.category : libre);
    setDescripcion(oficio?.description ?? '');
    setExperiencia(oficio?.yearsExperience ? String(oficio.yearsExperience) : '2');
    setModalVisible(true);
  };

  const handleSaveProfile = () => {
    if (selectedCat === 'otro' && otroOficio.trim().length < 3) {
      Alert.alert('Escribe el oficio', 'Cuando eliges "Otro", escribe qué oficio es.');
      return;
    }
    const eraEdicion = Boolean(editingId);
    upsertProfile.mutate(
      {
        category: selectedCat,
        description:
          (selectedCat === 'otro' ? `Oficio: ${otroOficio.trim()}. ` : '') +
          (descripcion.trim() || 'Servicios para vecinos de la zona.'),
        yearsExperience: parseInt(experiencia, 10) || 0,
        existingId: editingId ?? undefined,
        ...(savedLocation ? { location: { lat: savedLocation.lat, lng: savedLocation.lng } } : {}),
      },
      {
        onSuccess: () => {
          setModalVisible(false);
          setExitoOficioMsg(
            eraEdicion
              ? 'Los datos de tu oficio se actualizaron correctamente.'
              : 'Tu oficio ya está publicado y visible para tus vecinos.'
          );
        },
      }
    );
  };

  const handleConfirmDeleteOficio = () => {
    if (!confirmDeleteOficio || deleteProfile.isPending) return;
    deleteProfile.mutate(confirmDeleteOficio.id, {
      onSuccess: () => {
        setConfirmDeleteOficio(null);
        setModalVisible(false);
      },
    });
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    clearSession();
    router.replace('/welcome');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.titulo, { color: p.text }]}>Mi Perfil</Text>
      </View>

      {/* Tarjeta principal unificada: Identidad + Ubicación + Resumen */}
      <Card>
        <View style={styles.usuarioRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cambiar foto de perfil"
            onPress={cambiarFoto}
            disabled={updateAvatar.isPending}
            style={styles.avatarWrap}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.azul }]}>
                <Text style={styles.avatarText}>{initials || 'V'}</Text>
              </View>
            )}
            <View style={styles.avatarEdit}>
              {updateAvatar.isPending ? (
                <ActivityIndicator size="small" color={colors.blanco} />
              ) : (
                <Ionicons name="camera" size={12} color={colors.blanco} />
              )}
            </View>
          </Pressable>

          <View style={styles.usuarioInfo}>
            <Text style={[styles.nombre, { color: p.text }]} numberOfLines={1}>
              {userFullName}
            </Text>
            {userEmail ? (
              <Text style={[styles.correo, { color: p.muted }]} numberOfLines={1}>
                {userEmail}
              </Text>
            ) : null}
            <View style={styles.zonaBadgeRow}>
              <View style={[styles.zonaPill, { backgroundColor: p.highlight }]}>
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.azul} />
                <Text style={styles.zonaPillText}>{nombreZona}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardDivider} />

        {/* Fila de Ubicación y Lugar guardada */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Configurar mi ubicación en el mapa"
          onPress={() => router.push('/ubicacion')}
          style={styles.ubicacionRow}
        >
          <View style={[styles.ubicacionIconBox, { backgroundColor: colors.azulSuave }]}>
            <Ionicons name="location-outline" size={18} color={colors.azul} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.ubicacionTitle, { color: p.text }]} numberOfLines={1}>
              {savedLocation?.address || 'Sin ubicación exacta marcada'}
            </Text>
            <Text style={[styles.ubicacionSub, { color: p.muted }]} numberOfLines={1}>
              {savedLocation
                ? `Zona ${nombreZona} · (${savedLocation.lat.toFixed(4)}, ${savedLocation.lng.toFixed(4)})`
                : `Zona ${nombreZona} · Toca para marcar tu punto en el mapa`}
            </Text>
          </View>
          <View style={styles.ubicacionActionPill}>
            <Text style={styles.ubicacionActionText}>{savedLocation ? 'Cambiar' : 'Ubicar'}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.azul} />
          </View>
        </Pressable>

        <View style={styles.cardDivider} />

        {/* Métricas compactas en una sola franja limpia */}
        <View style={styles.metricasRow}>
          <View style={styles.metrica}>
            <Text style={[styles.metricaValor, { color: colors.verdeExito }]}>{totalVistosBuenos}</Text>
            <Text style={styles.metricaLabel}>Vistos buenos</Text>
          </View>
          <View style={styles.metricaDivider} />
          <View style={styles.metrica}>
            <Text style={[styles.metricaValor, { color: colors.azul }]}>{misOficios.length}</Text>
            <Text style={styles.metricaLabel}>{misOficios.length === 1 ? 'Oficio' : 'Oficios'}</Text>
          </View>
          <View style={styles.metricaDivider} />
          <View style={styles.metrica}>
            <Text style={[styles.metricaValor, { color: colors.naranja }]}>{misFavores}</Text>
            <Text style={styles.metricaLabel}>Favores activos</Text>
          </View>
        </View>
      </Card>

      {/* Sección: Mis oficios con botón compacto y menús contextuales */}
      <View style={styles.seccionHeaderRow}>
        <Text style={[styles.seccionLabel, { color: p.text }]}>Mis oficios</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agregar otro oficio"
          onPress={() => handleOpenModal(null)}
          style={[styles.addOficioPill, { backgroundColor: colors.naranja }]}
        >
          <Ionicons name="add" size={16} color={colors.azul} />
          <Text style={styles.addOficioPillText}>Agregar oficio</Text>
        </Pressable>
      </View>

      {cargandoOficios ? (
        <ActivityIndicator size="large" color={p.primary} style={{ marginVertical: spacing.md }} />
      ) : misOficios.length === 0 ? (
        <Card onPress={() => handleOpenModal(null)}>
          <View style={styles.sinOficioRow}>
            <View style={[styles.oficioCatIcon, { backgroundColor: p.highlight }]}>
              <Ionicons name="construct-outline" size={22} color={colors.azul} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sinOficioTitulo, { color: p.text }]}>¿Ofreces algún oficio o servicio?</Text>
              <Text style={[styles.sinOficioTexto, { color: p.muted }]}>
                Publica tu especialidad para que tus vecinos te encuentren en el directorio y el mapa.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={p.muted} />
          </View>
        </Card>
      ) : (
        misOficios.map((of) => (
          <Card key={of.id}>
            <View style={styles.oficioCompactRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ver detalle de ${oficioLabel[of.oficio.category]}`}
                onPress={() => router.push(`/oficio/${of.id}`)}
                style={styles.oficioMainArea}
              >
                <View style={[styles.oficioCatIcon, { backgroundColor: p.highlight }]}>
                  <Ionicons name={oficioIcon[of.oficio.category]} size={20} color={colors.azul} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.oficioTitleLine}>
                    <Text style={[styles.oficioNombre, { color: p.text }]} numberOfLines={1}>
                      {oficioLabel[of.oficio.category]}
                    </Text>
                    <ValidationBadge validatedCount={of.validatedCount} />
                  </View>
                  <Text style={[styles.oficioExp, { color: p.muted }]}>
                    {of.yearsExperience ? `${of.yearsExperience} años de experiencia` : 'Recién registrado'}
                  </Text>
                  {of.description ? (
                    <Text style={[styles.oficioDesc, { color: colors.texto }]} numberOfLines={2}>
                      {of.description}
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Opciones de ${oficioLabel[of.oficio.category]}`}
                hitSlop={10}
                onPress={() => setMenuOficio(of)}
                style={styles.contextMenuBtn}
              >
                <Ionicons name="ellipsis-vertical" size={18} color={colors.azul} />
              </Pressable>
            </View>
          </Card>
        ))
      )}

      {/* Sección: Simulaciones del Reto */}
      {SHOW_DEMO_TOOLS ? (
        <>
          <Text style={[styles.seccionLabel, { color: p.text, marginTop: spacing.md }]}>
            Simulaciones del Reto (Hackathon)
          </Text>
          <Card>
            <ToggleRow
              label="Simular modo emergencia"
              value={simulatedEmergency}
              onChange={setSimulatedEmergency}
            />
            {serverEmergency ? (
              <Text style={[styles.sinOficioTexto, { color: colors.rojo }]}>
                Tu zona está en emergencia real según el sistema.
              </Text>
            ) : null}
            <View style={styles.separador} />
            <ToggleRow
              label="Simular modo sin conexión"
              value={!isOnline}
              onChange={(v) => setOnline(!v)}
            />
          </Card>
        </>
      ) : null}

      {/* Ajustes rápidos minimalistas */}
      <Text style={[styles.seccionLabel, { color: p.text, marginTop: spacing.md, marginBottom: 8 }]}>
        Ajustes y cuenta
      </Text>
      <Card>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/ubicacion')}
          style={styles.menuItemRow}
        >
          <Ionicons name="map-outline" size={20} color={colors.azul} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuItemTitle, { color: p.text }]}>Marcar o cambiar mi ubicación</Text>
            <Text style={[styles.menuItemSub, { color: p.muted }]} numberOfLines={1}>
              {savedLocation?.address || 'Elige dónde vives o trabajas en el mapa'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={p.muted} />
        </Pressable>

        <View style={styles.separador} />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/welcome')}
          style={styles.menuItemRow}
        >
          <Ionicons name="help-circle-outline" size={20} color={colors.azul} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuItemTitle, { color: p.text }]}>Ver guía de uso de Barrio</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={p.muted} />
        </Pressable>

        <View style={styles.separador} />

        <Pressable
          accessibilityRole="button"
          onPress={handleLogout}
          style={styles.menuItemRow}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.rojo} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuItemTitle, { color: colors.rojo }]}>Cerrar sesión</Text>
          </View>
        </Pressable>
      </Card>

      {/* Menú contextual (⋮) de opciones de un oficio */}
      <Modal
        visible={menuOficio !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOficio(null)}
      >
        <Pressable style={styles.centerOverlay} onPress={() => setMenuOficio(null)}>
          <Pressable onPress={() => {}} style={styles.contextSheet}>
            <View style={styles.contextSheetHeader}>
              <View style={[styles.oficioCatIcon, { backgroundColor: p.highlight }]}>
                <Ionicons
                  name={menuOficio ? oficioIcon[menuOficio.oficio.category] : 'construct-outline'}
                  size={20}
                  color={colors.azul}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.contextSheetTitle, { color: p.text }]}>
                  {menuOficio ? oficioLabel[menuOficio.oficio.category] : 'Oficio'}
                </Text>
                <Text style={[styles.contextSheetSub, { color: p.muted }]}>
                  Opciones del oficio
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar menú"
                onPress={() => setMenuOficio(null)}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={p.muted} />
              </Pressable>
            </View>

            <View style={styles.separador} />

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const target = menuOficio;
                setMenuOficio(null);
                if (target) router.push(`/oficio/${target.id}`);
              }}
              style={styles.contextActionRow}
            >
              <Ionicons name="eye-outline" size={20} color={colors.azul} />
              <Text style={[styles.contextActionText, { color: p.text }]}>Ver ficha pública</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (menuOficio) handleOpenModal(menuOficio);
              }}
              style={styles.contextActionRow}
            >
              <Ionicons name="create-outline" size={20} color={colors.azul} />
              <Text style={[styles.contextActionText, { color: p.text }]}>Editar este oficio</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const target = menuOficio;
                setMenuOficio(null);
                if (target) {
                  deleteProfile.reset();
                  setConfirmDeleteOficio(target);
                }
              }}
              style={styles.contextActionRow}
            >
              <Ionicons name="trash-outline" size={20} color={colors.rojo} />
              <Text style={[styles.contextActionText, { color: colors.rojo }]}>Eliminar oficio</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal para registrar o editar oficio */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable onPress={() => {}} style={[styles.modalCard, { backgroundColor: colors.blanco }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: p.text }]}>
                {editingId ? 'Editar mi oficio' : 'Agregar otro oficio'}
              </Text>
              <Text style={[styles.modalSub, { color: p.muted }]}>
                Comparte tus habilidades técnicas con tus vecinos para recibir recomendaciones y avales.
              </Text>

              <Text style={[styles.inputLabel, { color: p.text }]}>Categoría técnica</Text>
              <View style={styles.catChips}>
                {categorias.map((cat) => (
                  <Chip
                    key={cat}
                    label={oficioLabel[cat]}
                    selected={selectedCat === cat}
                    onPress={() => setSelectedCat(cat)}
                  />
                ))}
              </View>

              {selectedCat === 'otro' ? (
                <OtroInput
                  label="Escribe qué oficio es"
                  value={otroOficio}
                  onChangeText={setOtroOficio}
                  placeholder="Ej: Tapicero"
                />
              ) : null}

              <Text style={[styles.inputLabel, { color: p.text }]}>Años de experiencia</Text>
              <TextInput
                value={experiencia}
                onChangeText={setExperiencia}
                keyboardType="numeric"
                placeholder="Ej. 5"
                placeholderTextColor={colors.gris}
                style={[styles.modalInput, { borderColor: p.border, color: p.text }]}
              />

              <Text style={[styles.inputLabel, { color: p.text }]}>Descripción del servicio</Text>
              <TextInput
                value={descripcion}
                onChangeText={setDescripcion}
                placeholder="Describe qué trabajos realizas y cómo ayudas a tus vecinos..."
                placeholderTextColor={colors.gris}
                multiline
                numberOfLines={3}
                style={[
                  styles.modalInput,
                  { minHeight: 80, textAlignVertical: 'top', borderColor: p.border, color: p.text },
                ]}
              />

              {upsertProfile.error ? (
                <Text accessibilityRole="alert" style={styles.modalError}>
                  No se pudo guardar tu oficio: {upsertProfile.error.message}
                </Text>
              ) : null}

              <View style={{ marginTop: spacing.md, gap: 8 }}>
                <AppButton
                  label={upsertProfile.isPending ? 'Guardando...' : 'Guardar y publicar'}
                  variant="accent"
                  onPress={handleSaveProfile}
                  disabled={upsertProfile.isPending}
                />
                <AppButton
                  label="Cancelar"
                  variant="link"
                  onPress={() => setModalVisible(false)}
                />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de confirmación para eliminar oficio */}
      <Modal
        visible={confirmDeleteOficio !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDeleteOficio(null)}
      >
        <Pressable style={styles.centerOverlay} onPress={() => setConfirmDeleteOficio(null)}>
          <Pressable onPress={() => {}} style={styles.centerDialog}>
            <View style={[styles.dialogIconWrap, { backgroundColor: colors.rojoSuave }]}>
              <Ionicons name="trash-outline" size={28} color={colors.rojo} />
            </View>
            <Text style={[styles.dialogTitle, { color: p.text }]}>¿Eliminar este oficio?</Text>
            <Text style={[styles.dialogBody, { color: p.body }]}>
              {confirmDeleteOficio
                ? `Se quitará "${oficioLabel[confirmDeleteOficio.oficio.category]}" de tu perfil y del directorio del barrio.`
                : ''}
            </Text>
            {deleteProfile.error ? (
              <Text accessibilityRole="alert" style={styles.modalError}>
                No se pudo eliminar: {(deleteProfile.error as Error).message}
              </Text>
            ) : null}
            <AppButton
              label={deleteProfile.isPending ? 'Eliminando...' : 'Sí, eliminar oficio'}
              variant="danger"
              icon="trash-outline"
              disabled={deleteProfile.isPending}
              onPress={handleConfirmDeleteOficio}
            />
            <AppButton
              label="Cancelar"
              variant="secondary"
              disabled={deleteProfile.isPending}
              onPress={() => setConfirmDeleteOficio(null)}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de éxito al guardar/publicar oficio */}
      <Modal
        visible={exitoOficioMsg !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setExitoOficioMsg(null)}
      >
        <Pressable style={styles.centerOverlay} onPress={() => setExitoOficioMsg(null)}>
          <Pressable onPress={() => {}} style={styles.centerDialog}>
            <View style={[styles.dialogIconWrap, { backgroundColor: p.highlight }]}>
              <Ionicons name="checkmark-circle" size={32} color={colors.verdeExito} />
            </View>
            <Text style={[styles.dialogTitle, { color: p.text }]}>¡Oficio guardado!</Text>
            <Text style={[styles.dialogBody, { color: p.body }]}>{exitoOficioMsg}</Text>
            <AppButton label="Listo" icon="checkmark" onPress={() => setExitoOficioMsg(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm },
  titulo: { fontSize: 26, fontFamily: fonts.bold },
  usuarioRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.blanco, fontSize: 20, fontFamily: fonts.bold },
  avatarWrap: { position: 'relative' },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.azul,
    borderWidth: 2,
    borderColor: colors.blanco,
  },
  usuarioInfo: { flex: 1 },
  nombre: { fontSize: 19, fontFamily: fonts.bold, marginBottom: 1 },
  correo: { fontSize: 13, fontFamily: fonts.regular, marginBottom: 6 },
  zonaBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  zonaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  zonaPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.azul,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.grisBorde,
    marginVertical: 12,
  },
  ubicacionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ubicacionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ubicacionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  ubicacionSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 1,
  },
  ubicacionActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.fondo,
  },
  ubicacionActionText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.azul,
  },
  metricasRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 2,
  },
  metrica: { alignItems: 'center', flex: 1 },
  metricaValor: { fontSize: 20, fontFamily: fonts.bold },
  metricaLabel: { fontSize: 12, fontFamily: fonts.medium, color: colors.gris, marginTop: 1 },
  metricaDivider: { width: 1, height: 28, backgroundColor: colors.grisBorde },
  seccionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: 8,
  },
  seccionLabel: { fontSize: 16, fontFamily: fonts.bold },
  addOficioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  addOficioPillText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.azul,
  },
  oficioCompactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  oficioMainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  oficioCatIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  oficioTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  oficioNombre: { fontSize: 16, fontFamily: fonts.bold },
  oficioExp: { fontSize: 13, fontFamily: fonts.medium, marginTop: 2 },
  oficioDesc: { fontSize: 13, fontFamily: fonts.regular, lineHeight: 18, marginTop: 4 },
  contextMenuBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fondo,
  },
  sinOficioRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sinOficioTitulo: { fontSize: 15, fontFamily: fonts.semiBold, marginBottom: 2 },
  sinOficioTexto: { fontSize: 13, fontFamily: fonts.regular, lineHeight: 18 },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  menuItemTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  menuItemSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 1,
  },
  separador: { height: 1, backgroundColor: colors.grisBorde, marginVertical: 8 },
  contextSheet: {
    backgroundColor: colors.blanco,
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  contextSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  contextSheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  contextSheetSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  contextActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: radius.md,
  },
  contextActionText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 46, 102, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 22, fontFamily: fonts.bold, marginBottom: 4 },
  modalSub: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20, marginBottom: spacing.md },
  inputLabel: { fontSize: 15, fontFamily: fonts.semiBold, marginBottom: 6, marginTop: spacing.sm },
  catChips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs },
  modalError: { color: colors.rojo, fontSize: 14, fontFamily: fonts.medium, lineHeight: 20, marginTop: spacing.sm },
  modalInput: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fonts.regular,
    marginBottom: spacing.xs,
  },
  centerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 46, 102, 0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  centerDialog: {
    backgroundColor: colors.blanco,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  dialogIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  dialogTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  dialogBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
