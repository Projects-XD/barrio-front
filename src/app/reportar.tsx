import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Chip } from '@/components/Chip';
import { OtroInput } from '@/components/OtroInput';
import { Screen } from '@/components/Screen';
import { ToggleRow } from '@/components/ToggleRow';
import { usePalette } from '@/hooks/usePalette';
import { useCreateReport } from '@/hooks/useData';
import { resourceLabel } from '@/i18n/labels';
import type { ResourceType } from '@/types';
import { colors, fonts, radius, spacing } from '@/theme';

const necesidades = Object.keys(resourceLabel) as ResourceType[];

export default function Reportar() {
  const p = usePalette();
  const crear = useCreateReport();
  const [descripcion, setDescripcion] = useState('');
  const [needs, setNeeds] = useState<ResourceType[]>([]);
  const [otraNecesidad, setOtraNecesidad] = useState('');
  const [anonimo, setAnonimo] = useState(true);
  const [conUbicacion, setConUbicacion] = useState(false);

  const toggleNeed = (n: ResourceType) =>
    setNeeds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  const obtenerUbicacion = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  };

  const enviar = async () => {
    try {
      const location = conUbicacion ? await obtenerUbicacion().catch(() => null) : null;
      const { queued } = await crear.mutateAsync({
        description:
          needs.includes('otro') && otraNecesidad.trim()
            ? `${descripcion.trim()} (Otra necesidad: ${otraNecesidad.trim()})`
            : descripcion.trim(),
        needs,
        isAnonymous: anonimo,
        location,
      });
      Alert.alert(
        queued ? 'Guardado sin conexión' : 'Reporte enviado',
        queued
          ? 'El reporte se enviará solo cuando vuelva la conexión.'
          : 'Los vecinos de tu zona y los grupos de apoyo ya pueden verlo.',
        [{ text: 'Entendido', onPress: () => router.back() }],
      );
    } catch (err) {
      Alert.alert('No se pudo enviar el reporte', (err as Error)?.message ?? 'Inténtalo de nuevo.');
    }
  };

  return (
    <Screen>
      <Text style={[styles.label, { color: p.text }]}>¿Qué está pasando?</Text>
      <TextInput
        value={descripcion}
        onChangeText={setDescripcion}
        placeholder="Ej: Adulta mayor sola, sin agua desde ayer"
        placeholderTextColor={colors.gris}
        multiline
        maxLength={500}
        style={[styles.input, { borderColor: p.border, color: p.text }]}
      />

      <Text style={[styles.label, { color: p.text }]}>¿Qué necesita?</Text>
      <View style={styles.chips}>
        {necesidades.map((n) => (
          <Chip key={n} label={resourceLabel[n]} selected={needs.includes(n)} onPress={() => toggleNeed(n)} />
        ))}
      </View>

      {needs.includes('otro') ? (
        <OtroInput
          label="Escribe qué otra cosa necesita"
          value={otraNecesidad}
          onChangeText={setOtraNecesidad}
          placeholder="Ej: Silla de ruedas"
        />
      ) : null}
      <ToggleRow label="Reportar de forma anónima" value={anonimo} onChange={setAnonimo} />
      <ToggleRow label="Agregar mi ubicación aproximada" value={conUbicacion} onChange={setConUbicacion} />
      <Text style={[styles.nota, { color: p.muted }]}>
        La ubicación se redondea a unos 100 metros. Nunca se guarda la dirección exacta.
      </Text>

      <Text style={[styles.nota, { color: colors.rojo, fontWeight: '600' }]}>
        Si es urgente, llama al 105 (Policía), 116 (Bomberos) o 106 (SAMU). Este reporte no reemplaza una llamada de emergencia.
      </Text>
      <AppButton
        label={crear.isPending ? 'Enviando...' : 'Enviar reporte'}
        variant="primary"
        onPress={enviar}
        disabled={descripcion.trim().length < 5 || (needs.includes('otro') && otraNecesidad.trim().length < 3) || crear.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semiBold, fontSize: 16, marginTop: spacing.md, marginBottom: 6 },
  input: {
    minHeight: 110,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    textAlignVertical: 'top',
    backgroundColor: colors.blanco,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  nota: { fontFamily: fonts.regular, fontSize: 14, marginTop: 4, marginBottom: spacing.md },
});
