import { useState } from 'react';
import {
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
import { Screen } from '@/components/Screen';
import { ToggleRow } from '@/components/ToggleRow';
import { ValidationBadge } from '@/components/ValidationBadge';
import { usePalette } from '@/hooks/usePalette';
import { useAppStore } from '@/store/app-store';
import { useMyProfile, useUpsertMyProfile } from '@/hooks/useData';
import { oficioLabel } from '@/i18n/labels';
import type { OficioCategory } from '@/types';
import { colors, fonts, radius, spacing } from '@/theme';

const categorias = Object.keys(oficioLabel) as OficioCategory[];

export default function Perfil() {
  const p = usePalette();
  const emergency = useAppStore((s) => s.emergencyActive);
  const setEmergency = useAppStore((s) => s.setEmergency);
  const isOnline = useAppStore((s) => s.isOnline);
  const setOnline = useAppStore((s) => s.setOnline);
  const clearSession = useAppStore((s) => s.clearSession);

  const { data: myProfile } = useMyProfile();
  const upsertProfile = useUpsertMyProfile();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCat, setSelectedCat] = useState<OficioCategory>(
    myProfile?.oficio.category ?? 'gasfiteria'
  );
  const [descripcion, setDescripcion] = useState(myProfile?.description ?? '');
  const [experiencia, setExperiencia] = useState(
    myProfile?.yearsExperience ? String(myProfile.yearsExperience) : '2'
  );

  const handleOpenModal = () => {
    if (myProfile) {
      setSelectedCat(myProfile.oficio.category);
      setDescripcion(myProfile.description);
      setExperiencia(myProfile.yearsExperience ? String(myProfile.yearsExperience) : '2');
    }
    setModalVisible(true);
  };

  const handleSaveProfile = () => {
    upsertProfile.mutate(
      {
        category: selectedCat,
        description: descripcion.trim() || 'Servicios profesionales para vecinos de la zona.',
        yearsExperience: parseInt(experiencia, 10) || 1,
      },
      {
        onSuccess: () => setModalVisible(false),
      }
    );
  };

  const handleLogout = () => {
    clearSession();
    router.replace('/welcome');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.titulo, { color: p.text }]}>Mi Perfil</Text>
        <Text style={[styles.subtitulo, { color: p.muted }]}>
          Gestiona tu identidad vecinal y preferencias de la app.
        </Text>
      </View>

      <Card>
        <View style={styles.usuarioRow}>
          <View style={[styles.avatar, { backgroundColor: colors.azul }]}>
            <Text style={styles.avatarText}>AG</Text>
          </View>
          <View style={styles.usuarioInfo}>
            <Text style={[styles.nombre, { color: p.text }]}>Alexander García</Text>
            <Text style={[styles.zona, { color: p.muted }]}>Zona: Castilla · Miembro activo</Text>
          </View>
        </View>
      </Card>

      {/* Sección: Mi Oficio Profesional en el Barrio */}
      <Text style={[styles.seccionLabel, { color: p.text }]}>Mi oficio en el barrio</Text>
      {myProfile ? (
        <Card>
          <View style={styles.oficioHeader}>
            <View>
              <Text style={[styles.oficioNombre, { color: p.text }]}>
                {oficioLabel[myProfile.oficio.category]}
              </Text>
              <Text style={[styles.oficioExp, { color: p.muted }]}>
                {myProfile.yearsExperience ? `${myProfile.yearsExperience} años de experiencia` : 'Oficio registrado'}
              </Text>
            </View>
            <ValidationBadge validatedCount={myProfile.validatedCount} />
          </View>

          <Text style={[styles.oficioDesc, { color: colors.texto }]}>
            {myProfile.description}
          </Text>

          <View style={{ marginTop: spacing.sm }}>
            <AppButton
              label="Editar mi oficio"
              variant="secondary"
              onPress={handleOpenModal}
            />
          </View>
        </Card>
      ) : (
        <Card>
          <View style={styles.sinOficioRow}>
            <Ionicons name="construct-outline" size={26} color={colors.azul} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.sinOficioTitulo, { color: p.text }]}>
                ¿Ofreces algún oficio o servicio?
              </Text>
              <Text style={[styles.sinOficioTexto, { color: p.muted }]}>
                Publica tu especialidad para que tus vecinos te conozcan y te den su visto bueno.
              </Text>
            </View>
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <AppButton
              label="Ofrecer un oficio en el barrio"
              variant="accent"
              onPress={handleOpenModal}
            />
          </View>
        </Card>
      )}

      {/* Sección: Reputación vecinal */}
      <Text style={[styles.seccionLabel, { color: p.text }]}>Mi confianza comunitaria</Text>
      <Card>
        <View style={styles.metricasRow}>
          <View style={styles.metrica}>
            <Text style={[styles.metricaValor, { color: colors.naranja }]}>
              {myProfile ? myProfile.validatedCount : 3}
            </Text>
            <Text style={styles.metricaLabel}>Vistos buenos</Text>
          </View>
          <View style={styles.metricaDivider} />
          <View style={styles.metrica}>
            <Text style={[styles.metricaValor, { color: colors.azul }]}>2</Text>
            <Text style={styles.metricaLabel}>Favores dados</Text>
          </View>
        </View>
      </Card>

      {/* Sección: Simulaciones del Reto */}
      <Text style={[styles.seccionLabel, { color: p.text }]}>Simulaciones del Reto (Hackathon)</Text>
      <Card>
        <ToggleRow
          label="Modo emergencia activo"
          value={emergency}
          onChange={setEmergency}
        />
        <View style={styles.separador} />
        <ToggleRow
          label="Simular modo sin conexión"
          value={!isOnline}
          onChange={(v) => setOnline(!v)}
        />
      </Card>

      <View style={{ marginTop: spacing.md }}>
        <AppButton
          label="Ver tutorial de la app"
          variant="secondary"
          onPress={() => router.push('/welcome')}
        />
        <AppButton
          label="Cerrar sesión"
          variant="link"
          onPress={handleLogout}
        />
      </View>

      {/* Modal para registrar o editar oficio */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.blanco }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: p.text }]}>
                {myProfile ? 'Editar mi oficio' : 'Ofrecer un oficio'}
              </Text>
              <Text style={[styles.modalSub, { color: p.muted }]}>
                Tus vecinos de zona podrán verte en el directorio y darte su visto bueno.
              </Text>

              <Text style={[styles.inputLabel, { color: p.text }]}>Especialidad u oficio</Text>
              <View style={styles.catChips}>
                {categorias.map((c) => (
                  <Chip
                    key={c}
                    label={oficioLabel[c]}
                    selected={selectedCat === c}
                    onPress={() => setSelectedCat(c)}
                  />
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: p.text }]}>Años de experiencia</Text>
              <TextInput
                value={experiencia}
                onChangeText={setExperiencia}
                keyboardType="numeric"
                placeholder="Ej. 5"
                placeholderTextColor={colors.gris}
                style={[styles.modalInput, { borderColor: p.border, color: p.text }]}
              />

              <Text style={[styles.inputLabel, { color: p.text }]}>Descripción de tus servicios</Text>
              <TextInput
                value={descripcion}
                onChangeText={setDescripcion}
                multiline
                numberOfLines={3}
                placeholder="Describe brevemente tus trabajos y horarios..."
                placeholderTextColor={colors.gris}
                style={[styles.modalTextArea, { borderColor: p.border, color: p.text }]}
              />

              <View style={{ marginTop: spacing.md }}>
                <AppButton
                  label={upsertProfile.isPending ? 'Guardando...' : 'Guardar perfil profesional'}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.md, marginTop: spacing.xs },
  titulo: { fontSize: 28, fontFamily: fonts.bold, marginBottom: 4 },
  subtitulo: { fontSize: 15, fontFamily: fonts.regular, lineHeight: 20 },
  usuarioRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.blanco, fontFamily: fonts.bold, fontSize: 18 },
  usuarioInfo: { flex: 1 },
  nombre: { fontSize: 19, fontFamily: fonts.bold, marginBottom: 2 },
  zona: { fontSize: 14, fontFamily: fonts.medium },
  seccionLabel: { fontSize: 16, fontFamily: fonts.semiBold, marginTop: spacing.md, marginBottom: 8 },
  oficioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  oficioNombre: { fontSize: 18, fontFamily: fonts.bold },
  oficioExp: { fontSize: 13, fontFamily: fonts.medium, marginTop: 2 },
  oficioDesc: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20, marginVertical: spacing.xs },
  sinOficioRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sinOficioIcono: { fontSize: 32 },
  sinOficioTitulo: { fontSize: 16, fontFamily: fonts.semiBold, marginBottom: 2 },
  sinOficioTexto: { fontSize: 13, fontFamily: fonts.regular, lineHeight: 18 },
  metricasRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 4 },
  metrica: { alignItems: 'center' },
  metricaValor: { fontSize: 26, fontFamily: fonts.bold, marginBottom: 2 },
  metricaLabel: { fontSize: 14, fontFamily: fonts.regular, color: colors.gris },
  metricaDivider: { width: 1, height: 36, backgroundColor: colors.grisBorde },
  separador: { height: 1, backgroundColor: colors.grisBorde, marginVertical: 4 },
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
  modalInput: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  modalTextArea: {
    minHeight: 80,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: fonts.regular,
    textAlignVertical: 'top',
  },
});
