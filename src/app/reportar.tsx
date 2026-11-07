import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Chip } from '@/components/Chip';
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
  const [anonimo, setAnonimo] = useState(true);
  const [conUbicacion, setConUbicacion] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleNeed = (n: ResourceType) =>
    setNeeds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  const obtenerUbicacion = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  };

  const enviar = async () => {
    setErrorMsg(null);
    try {
      const location = conUbicacion ? await obtenerUbicacion().catch(() => null) : null;
      await crear.mutateAsync({
        description: descripcion.trim(),
        needs,
        isAnonymous: anonimo,
        location,
      });

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/emergencia');
      }
    } catch (err) {
      setErrorMsg(
        (err as Error)?.message ?? 'No se pudo enviar el reporte. Inténtalo de nuevo.'
      );
    }
  };

  return (
    <Screen>
      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      <Text style={[styles.label, { color: p.text }]}>¿Qué está pasando?</Text>
      <TextInput
        value={descripcion}
        onChangeText={setDescripcion}
        placeholder="Ej: Adulta mayor sola en primer piso, sin agua potable desde ayer..."
        placeholderTextColor={colors.gris}
        multiline
        maxLength={500}
        style={[styles.input, { borderColor: p.border, color: p.text }]}
      />

      <Text style={[styles.label, { color: p.text }]}>¿Qué apoyo necesita?</Text>
      <View style={styles.chips}>
        {necesidades.map((n) => (
          <Chip
            key={n}
            label={resourceLabel[n]}
            selected={needs.includes(n)}
            onPress={() => toggleNeed(n)}
          />
        ))}
      </View>

      <ToggleRow label="Reportar de forma anónima" value={anonimo} onChange={setAnonimo} />
      <ToggleRow
        label="Agregar mi ubicación aproximada"
        value={conUbicacion}
        onChange={setConUbicacion}
      />
      <Text style={[styles.nota, { color: p.muted }]}>
        La ubicación se redondea matemáticamente a unos 100 metros (3 decimales). Nunca se guarda la dirección exacta.
      </Text>

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          Si es una urgencia médica o incendio, llama al 105 (Policía), 116 (Bomberos) o 106 (SAMU). Este reporte alerta a tu red vecinal.
        </Text>
      </View>

      <View style={styles.buttonsStack}>
        <AppButton
          label={crear.isPending ? 'Enviando reporte...' : 'Enviar reporte a mi zona'}
          variant="accent"
          onPress={enviar}
          disabled={descripcion.trim().length < 5 || crear.isPending}
        />
        <AppButton
          label="Cancelar"
          variant="secondary"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/emergencia')
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    marginTop: spacing.xs,
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: '#991B1B',
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  input: {
    minHeight: 110,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 15.5,
    textAlignVertical: 'top',
    backgroundColor: colors.blanco,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.xs,
  },
  nota: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  warningBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: spacing.md,
  },
  warningText: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    color: colors.rojo,
    lineHeight: 19,
  },
  buttonsStack: {
    gap: 10,
    paddingBottom: spacing.lg,
  },
});
