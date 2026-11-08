import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Stack, router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { AppModal } from '@/components/AppModal';
import { MapPicker, type MapPickerHandle } from '@/components/MapPicker';
import { Screen } from '@/components/Screen';
import { reverseGeocodeCoords, useMySavedLocation, useSaveMyLocation } from '@/hooks/useData';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts, radius, spacing } from '@/theme';
import { CASTILLA_BOUNDS, CASTILLA_CENTER, type Coords, roundForReport } from '@/utils/geo';
import { CASTILLA_OUTLINE } from '@/utils/castillaOutline';

function formatPlace(place: Location.LocationGeocodedAddress | undefined) {
  if (!place) return '';
  return [place.street, place.name, place.district, place.city]
    .filter((part, i, arr) => Boolean(part) && arr.indexOf(part) === i)
    .join(', ');
}

async function resolveAddress(c: Coords): Promise<string> {
  const fromOsm = await reverseGeocodeCoords(c);
  if (fromOsm && !fromOsm.startsWith('Castilla, Piura (')) {
    return fromOsm;
  }
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: c.lat, longitude: c.lng });
    const texto = formatPlace(place);
    if (texto) return texto;
  } catch {
    // Fallback
  }
  return fromOsm;
}

export default function Ubicacion() {
  const p = usePalette();
  const mapRef = useRef<MapPickerHandle>(null);
  const { data: savedLocation, isPending: loadingSaved } = useMySavedLocation();
  const saveLocation = useSaveMyLocation();

  const [coords, setCoords] = useState<Coords>(() =>
    savedLocation ? { lat: savedLocation.lat, lng: savedLocation.lng } : CASTILLA_CENTER
  );
  const [direccion, setDireccion] = useState<string>(() => savedLocation?.address ?? '');
  const [buscando, setBuscando] = useState(false);
  const [resolviendoDir, setResolviendoDir] = useState(false);
  const [modalExito, setModalExito] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hydratedFromDbRef = useRef(false);

  const autocompletar = useCallback(async (c: Coords) => {
    setResolviendoDir(true);
    try {
      const texto = await resolveAddress(c);
      if (texto) setDireccion(texto);
    } finally {
      setResolviendoDir(false);
    }
  }, []);

  // Cuando llega la ubicación guardada en BD, centrar el mapa en ese punto y rellenar la dirección
  useEffect(() => {
    if (hydratedFromDbRef.current) return;
    if (savedLocation) {
      hydratedFromDbRef.current = true;
      const savedCoords = { lat: savedLocation.lat, lng: savedLocation.lng };
      const timer = setTimeout(() => {
        setCoords(savedCoords);
        setDireccion(savedLocation.address);
        mapRef.current?.setPoint(savedCoords);
      }, 60);
      return () => clearTimeout(timer);
    }
    if (!loadingSaved) {
      hydratedFromDbRef.current = true;
      let cancelado = false;
      resolveAddress(CASTILLA_CENTER).then((texto) => {
        if (!cancelado && texto) {
          setDireccion((prev) => prev || texto);
        }
      });
      return () => {
        cancelado = true;
      };
    }
  }, [savedLocation, loadingSaved]);

  const onMapChange = useCallback(
    (c: Coords) => {
      hydratedFromDbRef.current = true;
      setCoords(c);
      setErrorMsg(null);
      void autocompletar(c);
    },
    [autocompletar]
  );

  const usarMiUbicacion = async () => {
    setBuscando(true);
    setErrorMsg(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Sin permiso de GPS. Toca directamente el mapa para elegir tu ubicación.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      hydratedFromDbRef.current = true;
      setCoords(c);
      mapRef.current?.setPoint(c);
      await autocompletar(c);
    } catch {
      setErrorMsg('No pudimos obtener tu GPS actual. Toca el mapa para elegir el punto.');
    } finally {
      setBuscando(false);
    }
  };

  const irAlPerfil = () => {
    setModalExito(false);
    router.navigate('/(tabs)/perfil');
  };

  const guardar = () => {
    if (saveLocation.isPending) return;
    setErrorMsg(null);
    saveLocation.mutate(
      {
        lat: coords.lat,
        lng: coords.lng,
        address: direccion.trim(),
      },
      {
        onSuccess: (saved) => {
          setDireccion(saved.address);
          setModalExito(true);
        },
        onError: (err) => {
          setErrorMsg((err as Error)?.message ?? 'No se pudo guardar la ubicación.');
        },
      }
    );
  };

  const approx = roundForReport(coords);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Mi ubicación',
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver a mi perfil"
              onPress={irAlPerfil}
              hitSlop={10}
              style={styles.headerBackBtn}
            >
              <Ionicons name="arrow-back" size={22} color={p.primary} />
            </Pressable>
          ),
        }}
      />

      <Text style={[styles.titulo, { color: p.text }]}>Marca dónde vives o trabajas</Text>
      <Text style={[styles.sub, { color: p.muted }]}>
        Toca cualquier punto del mapa o usa tu ubicación actual. La dirección se completará automáticamente.
      </Text>

      <MapPicker
        ref={mapRef}
        initial={coords}
        height={320}
        maxBounds={CASTILLA_BOUNDS}
        outline={CASTILLA_OUTLINE}
        minZoom={11}
        maxZoom={18}
        onChange={onMapChange}
      />

      <AppButton
        label={buscando ? 'Buscando tu ubicación...' : 'Usar mi ubicación actual'}
        variant="secondary"
        icon="locate-outline"
        onPress={usarMiUbicacion}
        disabled={buscando}
      />

      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: p.text }]}>Dirección o referencia</Text>
        {resolviendoDir ? (
          <View style={styles.resolviendoRow}>
            <ActivityIndicator size="small" color={p.primary} />
            <Text style={[styles.resolviendoText, { color: p.primary }]}>Autocompletando...</Text>
          </View>
        ) : null}
      </View>
      <TextInput
        value={direccion}
        onChangeText={setDireccion}
        placeholder="Toca un punto en el mapa para autocompletar..."
        placeholderTextColor={p.muted}
        multiline
        style={[styles.input, { borderColor: p.border, color: p.text }]}
      />
      <Text style={[styles.hint, { color: p.muted }]}>
        Coordenadas seleccionadas: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
      </Text>

      {errorMsg ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {errorMsg}
        </Text>
      ) : null}

      <AppButton
        label={saveLocation.isPending ? 'Guardando...' : 'Guardar ubicación'}
        icon="checkmark-circle-outline"
        onPress={guardar}
        disabled={saveLocation.isPending}
      />
      <AppButton label="Cancelar y volver" variant="secondary" onPress={irAlPerfil} />

      <AppModal visible={modalExito} onClose={irAlPerfil} overlayStyle={styles.overlay} cardStyle={styles.tarjeta}>
            <View style={[styles.modalIcono, { backgroundColor: p.highlight }]}>
              <Ionicons name="checkmark-circle" size={34} color={colors.verdeExito} />
            </View>
            <Text style={[styles.tituloModal, { color: p.text }]}>¡Ubicación guardada!</Text>
            <Text style={[styles.textoModal, { color: p.body }]}>
              {direccion.trim() || 'Punto marcado en el mapa'}
            </Text>
            <Text style={[styles.subModal, { color: p.muted }]}>
              Posición aproximada para el barrio: {approx.lat}, {approx.lng}
            </Text>
            <AppButton label="Volver a mi perfil" icon="person-outline" onPress={irAlPerfil} />
      </AppModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBackBtn: {
    paddingRight: 12,
    paddingVertical: 4,
  },
  inlineBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.blanco,
    borderWidth: 1,
    borderColor: colors.grisBorde,
    marginBottom: spacing.xs,
  },
  inlineBackText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  titulo: { fontFamily: fonts.bold, fontSize: 24, marginTop: spacing.xs, marginBottom: 6 },
  sub: { fontFamily: fonts.regular, fontSize: 15, marginBottom: spacing.md },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: 6,
  },
  label: { fontFamily: fonts.semibold, fontSize: 15 },
  resolviendoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resolviendoText: { fontFamily: fonts.medium, fontSize: 13 },
  input: {
    minHeight: 80,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    textAlignVertical: 'top',
    backgroundColor: colors.blanco,
  },
  hint: { fontFamily: fonts.regular, fontSize: 14, marginTop: 6, marginBottom: spacing.md },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.rojo,
    marginBottom: spacing.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 46, 102, 0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  tarjeta: {
    backgroundColor: colors.blanco,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'stretch',
  },
  modalIcono: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  tituloModal: {
    fontFamily: fonts.bold,
    fontSize: 22,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  textoModal: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subModal: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
