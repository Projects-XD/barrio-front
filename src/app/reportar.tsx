import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { AppModal } from '@/components/AppModal';
import { Chip } from '@/components/Chip';
import { OtroInput } from '@/components/OtroInput';
import { Screen } from '@/components/Screen';
import { ToggleRow } from '@/components/ToggleRow';
import { usePalette } from '@/hooks/usePalette';
import { useCreateReport } from '@/hooks/useData';
import { resourceLabel } from '@/i18n/labels';
import type { ResourceType } from '@/types';
import { colors, fonts, radius, spacing } from '@/theme';
import { searchCastillaAddresses, type CastillaAddressItem } from '@/utils/castillaAddresses';

const necesidades = Object.keys(resourceLabel) as ResourceType[];

export default function Reportar() {
  const p = usePalette();
  const crear = useCreateReport();
  const [descripcion, setDescripcion] = useState('');
  const [quien, setQuien] = useState('');
  const [donde, setDonde] = useState('');
  const [needs, setNeeds] = useState<ResourceType[]>([]);
  const [otraNecesidad, setOtraNecesidad] = useState('');
  const [anonimo, setAnonimo] = useState(true);
  const [conUbicacion, setConUbicacion] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sugerencias, setSugerencias] = useState<CastillaAddressItem[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [suggestedCoords, setSuggestedCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Autocompletado de vías y sectores restringido a Castilla (Piura)
  useEffect(() => {
    let activo = true;
    const timer = setTimeout(async () => {
      const q = donde.trim();
      if (q.length < 2) {
        if (activo) {
          setSugerencias([]);
          setMostrarSugerencias(false);
        }
        return;
      }

      if (activo) setBuscandoUbicacion(true);
      try {
        const res = await searchCastillaAddresses(q);
        if (activo) {
          setSugerencias(res);
          setMostrarSugerencias(res.length > 0);
        }
      } catch {
        if (activo) setSugerencias([]);
      } finally {
        if (activo) setBuscandoUbicacion(false);
      }
    }, 220);

    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [donde]);

  // Alert.alert no se ve en la web: la confirmación va en un modal propio.
  const [confirmacion, setConfirmacion] = useState<'sent' | 'queued' | null>(null);
  const cerrarConfirmacion = () => {
    setConfirmacion(null);
    if (router.canGoBack()) router.back();
    else router.replace('/emergencia');
  };

  const toggleNeed = (n: ResourceType) =>
    setNeeds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  const obtenerUbicacion = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  };

  const enviar = async () => {
    if (submitting || crear.isPending) return;
    setSubmitting(true);
    try {
      const location = conUbicacion
        ? suggestedCoords || (await obtenerUbicacion().catch(() => null))
        : null;
      const { queued } = await crear.mutateAsync({
        description:
          needs.includes('otro') && otraNecesidad.trim()
            ? `${descripcion.trim()} (Otra necesidad: ${otraNecesidad.trim()})`
            : descripcion.trim(),
        needs,
        affectedName: quien,
        locationDetail: donde,
        isAnonymous: anonimo,
        location,
      });
      setConfirmacion(queued ? 'queued' : 'sent');
    } catch (err) {
      Alert.alert('No se pudo enviar el reporte', (err as Error)?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const seleccionarSugerencia = (item: CastillaAddressItem) => {
    setDonde(item.title);
    if (item.coords) {
      setSuggestedCoords(item.coords);
    }
    setMostrarSugerencias(false);
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
      <Text style={[styles.nota, { color: p.muted }]}>
        Esta descripción la ve toda tu zona: no escribas aquí nombres ni direcciones, van en los campos de abajo.
      </Text>

      <Text style={[styles.label, { color: p.text }]}>¿Quién necesita ayuda? (opcional)</Text>
      <TextInput
        value={quien}
        onChangeText={setQuien}
        placeholder="Ej: Doña Rosa, adulta mayor"
        placeholderTextColor={colors.gris}
        maxLength={100}
        style={[styles.inputLinea, { borderColor: p.border, color: p.text }]}
      />

      <View style={styles.dondeHeaderRow}>
        <Text style={[styles.label, { color: p.text, marginTop: 0, marginBottom: 0 }]}>¿Dónde está?</Text>
        {buscandoUbicacion ? <ActivityIndicator size="small" color={colors.azul} /> : null}
      </View>
      <TextInput
        value={donde}
        onChangeText={(text) => {
          setDonde(text);
          setSuggestedCoords(null);
        }}
        onFocus={() => {
          if (sugerencias.length > 0) setMostrarSugerencias(true);
        }}
        placeholder="Ej: Av. Guardia Civil o Jr. Ayacucho, Castilla"
        placeholderTextColor={colors.gris}
        maxLength={200}
        style={[styles.inputLinea, { borderColor: p.border, color: p.text }]}
      />

      {mostrarSugerencias && sugerencias.length > 0 ? (
        <View style={[styles.sugerenciasBox, { borderColor: p.border, backgroundColor: colors.blanco }]}>
          <Text style={[styles.sugerenciasTitulo, { color: p.muted }]}>
            Calles y sectores en Castilla
          </Text>
          {sugerencias.map((item, idx) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Elegir ${item.title}`}
              style={({ pressed }) => [
                styles.sugerenciaFila,
                idx > 0 && { borderTopWidth: 1, borderTopColor: p.border },
                pressed && { backgroundColor: p.highlight },
              ]}
              onPress={() => seleccionarSugerencia(item)}
            >
              <Ionicons name="location-outline" size={18} color={colors.azul} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.sugerenciaTitulo, { color: p.text }]}>{item.title}</Text>
                <Text style={[styles.sugerenciaSub, { color: p.muted }]}>{item.subtitle}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={[styles.nota, { color: p.muted }]}>
        El nombre y la dirección solo los ven los vecinos que se sumen a ayudar y el comité.
      </Text>

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
        label={submitting || crear.isPending ? 'Enviando reporte...' : 'Enviar reporte'}
        loading={submitting || crear.isPending}
        variant="primary"
        onPress={enviar}
        disabled={
          descripcion.trim().length < 5 ||
          donde.trim().length < 5 ||
          (needs.includes('otro') && otraNecesidad.trim().length < 3) ||
          submitting ||
          crear.isPending
        }
      />

      <AppModal visible={confirmacion !== null} onClose={cerrarConfirmacion} overlayStyle={styles.overlay} cardStyle={styles.modalCard}>
        <Ionicons
          name={confirmacion === 'queued' ? 'cloud-offline-outline' : 'checkmark-circle'}
          size={48}
          color={confirmacion === 'queued' ? colors.gris : colors.rojo}
          style={{ alignSelf: 'center' }}
        />
        <Text style={[styles.modalTitulo, { color: p.text }]}>
          {confirmacion === 'queued' ? 'Guardado sin conexión' : 'Alerta enviada'}
        </Text>
        <Text style={[styles.modalTexto, { color: p.body }]}>
          {confirmacion === 'queued'
            ? 'La alerta se enviará sola cuando vuelva la conexión.'
            : 'Los vecinos de tu zona y el comité de emergencia recibieron el aviso en la app. Te avisaremos cuando alguien vaya a ayudar.'}
        </Text>
        <AppButton label="Entendido" variant="primary" onPress={cerrarConfirmacion} />
      </AppModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semiBold, fontSize: 16, marginTop: spacing.md, marginBottom: 6 },
  dondeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: 6,
  },
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
  inputLinea: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 16,
    backgroundColor: colors.blanco,
  },
  sugerenciasBox: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    marginTop: 6,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  sugerenciasTitulo: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sugerenciaFila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sugerenciaTitulo: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  sugerenciaSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 2,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  nota: { fontFamily: fonts.regular, fontSize: 14, marginTop: 4, marginBottom: spacing.md },
  overlay: { flex: 1, backgroundColor: 'rgba(19, 46, 102, 0.5)', justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.blanco, borderRadius: radius.xl, padding: spacing.lg, width: '100%', maxWidth: 400, alignSelf: 'center', gap: spacing.sm },
  modalTitulo: { fontFamily: fonts.bold, fontSize: 20, textAlign: 'center' },
  modalTexto: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, textAlign: 'center', marginBottom: spacing.sm },
});
