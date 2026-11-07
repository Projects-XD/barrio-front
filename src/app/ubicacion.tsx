import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { MapPicker, type MapPickerHandle } from '@/components/MapPicker';
import { Screen } from '@/components/Screen';
import { useMyProfile, useUpsertMyProfile } from '@/hooks/useData';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts, radius, spacing } from '@/theme';
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
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const { data: myProfile } = useMyProfile();
  const upsert = useUpsertMyProfile();

  const autocompletar = async (c: Coords) => {
    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: c.lat,
        longitude: c.lng,
      });
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
    setFeedback(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setFeedback({
          type: 'error',
          text: 'Sin permiso de GPS. Puedes tocar el mapa directamente para marcar tu punto.',
        });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(c);
      mapRef.current?.setPoint(c);
      autocompletar(c);
    } catch {
      setFeedback({
        type: 'error',
        text: 'No pudimos obtener el GPS automático. Toca el mapa para elegir el punto.',
      });
    } finally {
      setBuscando(false);
    }
  };

  const guardar = () => {
    setFeedback(null);
    if (!myProfile) {
      setFeedback({
        type: 'success',
        text: `Ubicación de referencia marcada (${roundForReport(coords).lat}, ${roundForReport(coords).lng}). Si ofreces un oficio en Perfil, se asociará a este punto.`,
      });
      setTimeout(() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/perfil');
      }, 900);
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
        onSuccess: () => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)/perfil');
          }
        },
        onError: (err) =>
          setFeedback({
            type: 'error',
            text: err.message || 'No se pudo guardar la ubicación.',
          }),
      }
    );
  };

  return (
    <Screen>
      <Text style={[styles.titulo, { color: p.text }]}>
        Marca dónde vives o trabajas
      </Text>
      <Text style={[styles.sub, { color: p.muted }]}>
        Toca el mapa o usa tu ubicación actual para calcular la cercanía en tu zona.
      </Text>

      <MapPicker ref={mapRef} initial={coords} height={300} onChange={onMapChange} />

      <View style={{ marginTop: spacing.sm }}>
        <AppButton
          label={buscando ? 'Buscando tu ubicación...' : 'Usar mi ubicación actual'}
          variant="secondary"
          onPress={usarMiUbicacion}
          disabled={buscando}
        />
      </View>

      {feedback ? (
        <View
          style={[
            styles.feedbackBox,
            feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
          ]}
        >
          <Text
            style={[
              styles.feedbackText,
              { color: feedback.type === 'success' ? colors.azul : '#991B1B' },
            ]}
          >
            {feedback.text}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.label, { color: p.text }]}>Dirección o referencia</Text>
      <TextInput
        value={direccion}
        onChangeText={setDireccion}
        placeholder="Ej. Calle Ayacucho cdra. 4, frente al parque"
        placeholderTextColor={p.muted}
        multiline
        style={[
          styles.input,
          { borderColor: p.border, color: p.text, backgroundColor: colors.blanco },
        ]}
      />
      <Text style={[styles.hint, { color: p.muted }]}>
        En reportes de emergencia se redondea a ~100m ({roundForReport(coords).lat},{' '}
        {roundForReport(coords).lng}) por privacidad.
      </Text>

      <View style={styles.buttonsStack}>
        <AppButton
          label={upsert.isPending ? 'Guardando...' : 'Guardar ubicación'}
          variant="accent"
          onPress={guardar}
          disabled={upsert.isPending}
        />
        <AppButton
          label="Volver"
          variant="secondary"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(tabs)/perfil')
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titulo: {
    fontFamily: fonts.bold,
    fontSize: 24,
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  feedbackBox: {
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  feedbackSuccess: {
    backgroundColor: '#EEF5FD',
    borderColor: '#BFDBFE',
  },
  feedbackError: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  feedbackText: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    lineHeight: 19,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  input: {
    minHeight: 76,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 15.5,
    textAlignVertical: 'top',
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: 6,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  buttonsStack: {
    gap: 10,
    paddingBottom: spacing.lg,
  },
});
