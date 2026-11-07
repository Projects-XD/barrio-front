import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { MapPicker, type MapPickerHandle } from '@/components/MapPicker';
import { Screen } from '@/components/Screen';
import { useMyProfile, useUpsertMyProfile } from '@/hooks/useData';
import { usePalette } from '@/hooks/usePalette';
import { fonts, radius, spacing } from '@/theme';
import { CASTILLA_CENTER, type Coords, roundForReport } from '@/utils/geo';

function formatPlace(place: Location.LocationGeocodedAddress | undefined) {
  if (!place) return '';
  return [place.street, place.name, place.district, place.city]
    .filter((part, i, arr) => Boolean(part) && arr.indexOf(part) === i)
    .join(', ');
}

export default function Ubicacion() {
  const p = usePalette();
  const mapRef = useRef<MapPickerHandle>(null);
  const [coords, setCoords] = useState<Coords>(CASTILLA_CENTER);
  const [direccion, setDireccion] = useState('');
  const [buscando, setBuscando] = useState(false);
  const { data: myProfile } = useMyProfile();
  const upsert = useUpsertMyProfile();

  const autocompletar = async (c: Coords) => {
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: c.lat, longitude: c.lng });
      const texto = formatPlace(place);
      if (texto) setDireccion(texto);
    } catch {
      // Si falla, el usuario escribe la dirección a mano.
    }
  };

  const onMapChange = (c: Coords) => {
    setCoords(c);
    autocompletar(c);
  };

  const usarMiUbicacion = async () => {
    setBuscando(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Sin permiso', 'Puedes tocar el mapa para elegir tu ubicación.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(c);
      mapRef.current?.setPoint(c);
      autocompletar(c);
    } catch {
      Alert.alert('No pudimos obtener tu ubicación', 'Toca el mapa para elegir el punto.');
    } finally {
      setBuscando(false);
    }
  };

  // La ubicación exacta solo se guarda en el perfil del oficio; los reportes usan la redondeada.
  const guardar = () => {
    if (!myProfile) {
      Alert.alert(
        'Primero registra tu oficio',
        'La ubicación se guarda en tu perfil de oficio. Créalo desde Perfil y vuelve aquí.',
      );
      return;
    }
    upsert.mutate(
      {
        category: myProfile.oficio.category,
        description: myProfile.description,
        yearsExperience: myProfile.yearsExperience ?? 0,
        existingId: myProfile.id,
        location: coords,
      },
      {
        onSuccess: () =>
          Alert.alert(
            'Ubicación guardada',
            `${direccion || 'Punto marcado en el mapa'}\nPara reportes se usa una posición aproximada (${roundForReport(coords).lat}, ${roundForReport(coords).lng}).`,
            [{ text: 'OK', onPress: () => router.back() }],
          ),
        onError: (err) => Alert.alert('No se pudo guardar la ubicación', err.message),
      },
    );
  };

  return (
    <Screen>
      <Text style={[styles.titulo, { color: p.text }]}>Marca dónde vives o trabajas</Text>
      <Text style={[styles.sub, { color: p.muted }]}>
        Toca el mapa o usa tu ubicación actual. Puedes corregir la dirección.
      </Text>

      <MapPicker ref={mapRef} initial={coords} height={320} onChange={onMapChange} />

      <AppButton
        label={buscando ? 'Buscando tu ubicación...' : 'Usar mi ubicación actual'}
        variant="secondary"
        onPress={usarMiUbicacion}
        disabled={buscando}
      />

      <Text style={[styles.label, { color: p.text }]}>Dirección o referencia</Text>
      <TextInput
        value={direccion}
        onChangeText={setDireccion}
        placeholder="Ej. Calle 2, frente al colegio"
        placeholderTextColor={p.muted}
        multiline
        style={[styles.input, { borderColor: p.border, color: p.text }]}
      />
      <Text style={[styles.hint, { color: p.muted }]}>
        Se completa sola al mover el mapa. Puedes editarla.
      </Text>

      <AppButton
        label={upsert.isPending ? 'Guardando...' : 'Guardar ubicación'}
        onPress={guardar}
        disabled={upsert.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titulo: { fontFamily: fonts.bold, fontSize: 24, marginTop: spacing.sm, marginBottom: 6 },
  sub: { fontFamily: fonts.regular, fontSize: 15, marginBottom: spacing.md },
  label: { fontFamily: fonts.semibold, fontSize: 15, marginTop: spacing.md, marginBottom: 6 },
  input: {
    minHeight: 80,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  hint: { fontFamily: fonts.regular, fontSize: 13, marginTop: 6, marginBottom: spacing.md },
});
