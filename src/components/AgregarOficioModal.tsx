import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { AppModal } from '@/components/AppModal';
import { Chip } from '@/components/Chip';
import { OtroInput } from '@/components/OtroInput';
import { useMyProfiles, useMySavedLocation, useSuggestDescription, useUpsertMyProfile } from '@/hooks/useData';
import { usePalette } from '@/hooks/usePalette';
import { useAppStore } from '@/store/app-store';
import { oficioLabel } from '@/i18n/labels';
import type { OficioCategory } from '@/types';
import { colors, spacing } from '@/theme';
import { styles } from '@/features/perfil/styles';

const categorias = Object.keys(oficioLabel) as OficioCategory[];

type Props = { visible: boolean; onClose: () => void };

// Formulario para agregar un oficio desde cualquier pantalla. Se monta con una `key` nueva en cada
// apertura, así el formulario siempre arranca limpio. Para editar un oficio existente se usa Perfil.
export function AgregarOficioModal({ visible, onClose }: Props) {
  const p = usePalette();
  const isOnline = useAppStore((s) => s.isOnline);
  const { data: misOficios = [] } = useMyProfiles();
  const { data: savedLocation } = useMySavedLocation();
  const upsertProfile = useUpsertMyProfile();
  const suggestDescription = useSuggestDescription();

  const [paso, setPaso] = useState<'form' | 'exito'>('form');
  const [selectedCat, setSelectedCat] = useState<OficioCategory>(() => {
    const usados = misOficios.map((o) => o.oficio.category);
    return categorias.find((c) => !usados.includes(c)) ?? 'otro';
  });
  const [descripcion, setDescripcion] = useState('');
  const [experiencia, setExperiencia] = useState('2');
  const [otroOficio, setOtroOficio] = useState('');

  // Lo escrito en la descripción sirve de notas para la IA; el resultado reemplaza el texto y se puede editar.
  const handleSuggestDescription = () => {
    if (suggestDescription.isPending) return;
    suggestDescription.mutate(
      {
        category: selectedCat,
        ...(selectedCat === 'otro' && otroOficio.trim() ? { oficio_name: otroOficio.trim() } : {}),
        ...(parseInt(experiencia, 10) >= 0 ? { years_experience: parseInt(experiencia, 10) } : {}),
        ...(descripcion.trim() ? { notes: descripcion.trim().slice(0, 300) } : {}),
      },
      { onSuccess: (r) => setDescripcion(r.description) }
    );
  };

  const handleSave = () => {
    if (selectedCat === 'otro' && otroOficio.trim().length < 3) {
      Alert.alert('Escribe el oficio', 'Cuando eliges "Otro", escribe qué oficio es.');
      return;
    }
    upsertProfile.mutate(
      {
        category: selectedCat,
        description:
          (selectedCat === 'otro' ? `Oficio: ${otroOficio.trim()}. ` : '') +
          (descripcion.trim() || 'Servicios para vecinos de la zona.'),
        yearsExperience: parseInt(experiencia, 10) || 0,
        ...(savedLocation ? { location: { lat: savedLocation.lat, lng: savedLocation.lng } } : {}),
      },
      { onSuccess: () => setPaso('exito') }
    );
  };

  return (
    <>
      <AppModal
        visible={visible && paso === 'form'}
        onClose={onClose}
        animationType="slide"
        overlayStyle={styles.modalOverlay}
        cardStyle={[styles.modalCard, { backgroundColor: colors.blanco }]}
      >
        <View style={styles.modalHeaderRow}>
          <Text style={[styles.modalTitle, { color: p.text, flex: 1, marginBottom: 0 }]}>Agregar oficio</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar y cerrar"
            onPress={onClose}
            hitSlop={10}
            style={styles.modalCloseBtn}
          >
            <Ionicons name="close" size={22} color={p.muted} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
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
          <Text style={[styles.modalSub, { color: p.muted, marginTop: spacing.xs }]}>
            {isOnline
              ? 'Escribe unas palabras (ej. "arreglo caños, atiendo fines de semana") y mejóralas con IA. Siempre puedes editar el resultado.'
              : 'La sugerencia con IA necesita conexión a internet.'}
          </Text>
          <AppButton
            label={suggestDescription.isPending ? 'Generando...' : 'Mejorar con IA'}
            variant="secondary"
            icon="sparkles-outline"
            disabled={!isOnline || suggestDescription.isPending || upsertProfile.isPending}
            onPress={handleSuggestDescription}
          />
          {suggestDescription.error ? (
            <Text accessibilityRole="alert" style={styles.modalError}>
              {suggestDescription.error.message}
            </Text>
          ) : null}

          {upsertProfile.error ? (
            <Text accessibilityRole="alert" style={styles.modalError}>
              No se pudo guardar tu oficio: {upsertProfile.error.message}
            </Text>
          ) : null}

          <View style={{ marginTop: spacing.md }}>
            <AppButton
              label={upsertProfile.isPending ? 'Guardando...' : 'Guardar y publicar'}
              variant="accent"
              onPress={handleSave}
              disabled={upsertProfile.isPending}
            />
            <AppButton
              label="Cancelar"
              variant="secondary"
              disabled={upsertProfile.isPending}
              onPress={onClose}
            />
          </View>
        </ScrollView>
      </AppModal>

      <AppModal
        visible={visible && paso === 'exito'}
        onClose={onClose}
        animationType="fade"
        overlayStyle={styles.centerOverlay}
        cardStyle={styles.centerDialog}
      >
        <View style={[styles.dialogIconWrap, { backgroundColor: p.highlight }]}>
          <Ionicons name="checkmark-circle" size={32} color={colors.verdeExito} />
        </View>
        <Text style={[styles.dialogTitle, { color: p.text }]}>¡Oficio guardado!</Text>
        <Text style={[styles.dialogBody, { color: p.body }]}>
          Tu oficio ya está publicado y visible para tus vecinos.
        </Text>
        <AppButton label="Listo" icon="checkmark" onPress={onClose} />
      </AppModal>
    </>
  );
}
