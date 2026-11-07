import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { OtroInput } from '@/components/OtroInput';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import { usePalette } from '@/hooks/usePalette';
import { useCreateFavor } from '@/hooks/useData';
import { favorTypeIcon } from '@/i18n/icons';
import { favorTypeLabel, favorUrgencyLabel } from '@/i18n/labels';
import type { FavorType, FavorUrgency } from '@/types';
import { colors, fonts, radius, shadow, spacing } from '@/theme';

const tipos = Object.keys(favorTypeLabel) as FavorType[];

// Mismas categorías, redactadas desde quien pide o desde quien ofrece.
const ETIQUETAS: Record<'pedir' | 'ofrecer', Record<FavorType, string>> = {
  pedir: {
    herramienta: 'Necesito prestada una herramienta',
    ayuda_temporal: 'Necesito una mano por un rato',
    donacion_materiales: 'Necesito materiales o donaciones',
    intercambio_habilidades: 'Necesito aprender algo de alguien',
    movilidad_solidaria: 'Necesito que me lleven o acompañen',
    otros: 'Otra cosa que necesito',
  },
  ofrecer: {
    herramienta: 'Tengo una herramienta para prestar',
    ayuda_temporal: 'Puedo echar una mano por un rato',
    donacion_materiales: 'Tengo materiales para donar',
    intercambio_habilidades: 'Puedo enseñar lo que sé',
    movilidad_solidaria: 'Puedo llevar o acompañar a alguien',
    otros: 'Otra cosa que ofrezco',
  },
};
const urgencias = Object.keys(favorUrgencyLabel) as FavorUrgency[];

const PASOS = ['Elige el tipo', 'Escribe tu favor', 'Revisa y publica'];

export default function NuevoFavor() {
  const p = usePalette();
  const { modo } = useLocalSearchParams<{ modo?: string }>();
  // "ofrecer" o "pedir" (por defecto). Cambia los textos y el prefijo del favor publicado.
  const ofrecer = modo === 'ofrecer';
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<FavorType | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [texto, setTexto] = useState('');
  const [otroNombre, setOtroNombre] = useState('');
  const [urgencia, setUrgencia] = useState<FavorUrgency>('normal');
  const [resultado, setResultado] = useState<{ queued: boolean } | null>(null);
  const crear = useCreateFavor();

  const publicar = () => {
    if (!tipo || !texto.trim() || crear.isPending) return;
    crear.mutate(
      {
          type: tipo,
          // El título lleva el nombre de la opción "Otro" cuando la eliges, o Necesito/Ofrezco en el resto.
          title: (tipo === 'otros'
            ? `${otroNombre.trim()}: ${texto.trim()}`
            : `${ofrecer ? 'Ofrezco: ' : 'Necesito: '}${texto.trim()}`
          ).slice(0, 120),
          description: null,
          urgency: urgencia,
        },
      { onSuccess: ({ queued }) => setResultado({ queued }) }
    );
  };

  const irAFavores = () => {
    setResultado(null);
    router.replace('/(tabs)/favores');
  };

  return (
    <Screen>
      <Text style={[styles.pasoTexto, { color: p.muted }]}>
        Paso {paso} de 3 · {PASOS[paso - 1]}
      </Text>
      <View style={styles.progreso}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[styles.barra, { backgroundColor: n <= paso ? p.cta : p.border }]} />
        ))}
      </View>

      {paso === 1 && (
        <>
          <Text style={[styles.titulo, { color: p.text }]}>
            {ofrecer ? '¿Qué ofreces a tus vecinos?' : '¿Qué necesitas de tus vecinos?'}
          </Text>
          <Text style={[styles.sub, { color: p.muted }]}>Toca la opción que mejor describe tu favor.</Text>
          <View style={styles.grid}>
            {tipos.map((t) => {
              const activo = tipo === t;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                  onPress={() => setTipo(t)}
                  style={[
                    styles.opcion,
                    { borderColor: activo ? p.cta : 'transparent', backgroundColor: activo ? colors.naranjaClaro : colors.blanco },
                  ]}
                >
                  <View style={[styles.opcionIcono, { backgroundColor: activo ? p.cta : p.highlight }]}>
                    <Ionicons name={favorTypeIcon[t]} size={24} color={p.text} />
                  </View>
                  <Text style={[styles.opcionTexto, { color: p.text }]}>{ETIQUETAS[ofrecer ? 'ofrecer' : 'pedir'][t]}</Text>
                  {activo ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.verdeExito} style={styles.check} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <View style={{ marginTop: spacing.md }}>
            {tipo === 'otros' ? (
            <OtroInput
              label="Escribe qué tipo de favor es"
              value={otroNombre}
              onChangeText={setOtroNombre}
              placeholder="Ej: Cuidar plantas mientras viajo"
            />
          ) : null}
          <AppButton
            label="Siguiente"
            icon="arrow-forward"
            onPress={() => setPaso(2)}
            disabled={!tipo || (tipo === 'otros' && otroNombre.trim().length < 3)}
          />
          </View>
        </>
      )}

      {paso === 2 && (
        <>
          <Text style={[styles.titulo, { color: p.text }]}>
            {tipo === 'otros'
              ? '¿Qué otro favor necesitas u ofreces?'
              : ofrecer
                ? 'Describe lo que ofreces'
                : 'Describe lo que necesitas'}
          </Text>
          <Text style={[styles.sub, { color: p.muted }]}>
            {tipo === 'otros'
              ? 'Escribe con tus palabras qué necesitas o qué puedes ofrecer. Tus vecinos verán tu mensaje tal cual.'
              : 'Sé claro y específico para que tus vecinos puedan ayudarte rápido.'}
          </Text>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder={
              tipo === 'otros'
                ? 'Ej: Necesito que alguien me enseñe a usar una computadora'
                : 'Ej: Necesito prestada una escalera este sábado'
            }
            placeholderTextColor={colors.gris}
            multiline
            maxLength={120}
            style={[styles.input, { color: p.text }]}
          />
          <Text style={[styles.charCount, { color: p.muted }]}>{texto.trim().length}/120</Text>

          <Text style={[styles.urgenciaLabel, { color: p.text }]}>¿Qué tan urgente es?</Text>
          <View style={styles.urgencias}>
            {urgencias.map((u) => (
              <Chip key={u} label={favorUrgencyLabel[u]} selected={urgencia === u} onPress={() => setUrgencia(u)} />
            ))}
          </View>
          <Text style={[styles.urgenciaNota, { color: p.muted }]}>
            Tu favor será revisado por un administrador antes de publicarse.
          </Text>

          <View style={{ marginTop: spacing.md }}>
            <AppButton
              label="Siguiente"
              icon="arrow-forward"
              onPress={() => setPaso(3)}
              disabled={texto.trim().length < 3}
            />
            <AppButton label="Atrás" variant="secondary" onPress={() => setPaso(1)} />
          </View>
        </>
      )}

      {paso === 3 && tipo && (
        <>
          <Text style={[styles.titulo, { color: p.text }]}>Revisa tu publicación</Text>
          <Text style={[styles.sub, { color: p.muted }]}>Así la verán tus vecinos. No hay dinero de por medio.</Text>
          <Card>
            <View style={styles.resumenRow}>
              <View style={[styles.opcionIcono, { backgroundColor: p.highlight }]}>
                <Ionicons name={favorTypeIcon[tipo]} size={24} color={p.text} />
              </View>
              <View style={{ flex: 1 }}>
                <UrgencyBadge urgency={urgencia} />
                <Text style={[styles.resumenTipo, { color: p.muted }]}>{ETIQUETAS[ofrecer ? 'ofrecer' : 'pedir'][tipo]}</Text>
                <Text style={[styles.resumenTitulo, { color: p.text }]}>{texto.trim()}</Text>
              </View>
            </View>
          </Card>

          {crear.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              No se pudo publicar tu favor: {crear.error.message}
            </Text>
          ) : null}

          <View style={{ marginTop: spacing.md }}>
            {crear.isPending ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator size="large" color={p.primary} />
                <Text style={[styles.loadingText, { color: p.muted }]}>Publicando tu favor...</Text>
              </View>
            ) : (
              <>
                <AppButton
                  label="Publicar en el barrio"
                  icon="paper-plane-outline"
                  onPress={() => setConfirmando(true)}
                  disabled={crear.isPending}
                />
                <AppButton label="Atrás" variant="secondary" onPress={() => setPaso(2)} />
              </>
            )}
          </View>
        </>
      )}

      <Modal visible={confirmando} transparent animationType="fade" onRequestClose={() => setConfirmando(false)}>
        <Pressable style={styles.overlay} onPress={() => setConfirmando(false)}>
          <Pressable onPress={() => {}} style={styles.tarjeta}>
            <View style={[styles.modalIcono, { backgroundColor: p.highlight }]}>
              <Ionicons name="paper-plane" size={28} color={p.text} />
            </View>
            <Text style={[styles.tituloModal, { color: p.text }]}>¿Publicar tu favor?</Text>
            <Text style={[styles.textoModal, { color: p.body }]}>
              {tipo ? favorTypeLabel[tipo] : ''}: {texto.trim()}
            </Text>
            <Text style={[styles.textoModal, { color: p.muted }]}>
              Un administrador lo revisará antes de que lo vean los vecinos de tu zona.
            </Text>
            <AppButton
              label="Sí, publicar"
              icon="checkmark"
              onPress={() => {
                setConfirmando(false);
                publicar();
              }}
            />
            <AppButton label="Revisar otra vez" variant="secondary" onPress={() => setConfirmando(false)} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal y no Alert.alert, que en web (react-native-web) no hace nada. */}
      <Modal visible={resultado !== null} transparent animationType="fade" onRequestClose={irAFavores}>
        <View style={styles.overlay}>
          <View style={styles.tarjeta}>
            <View style={[styles.modalIcono, { backgroundColor: p.highlight }]}>
              <Ionicons name={resultado?.queued ? 'cloud-upload-outline' : 'checkmark'} size={28} color={p.text} />
            </View>
            <Text style={[styles.tituloModal, { color: p.text }]}>
              {resultado?.queued ? 'Guardado sin conexión' : '¡Favor enviado a revisión!'}
            </Text>
            <Text style={[styles.textoModal, { color: p.body }]}>
              {resultado?.queued
                ? 'Tu favor se guardó en el teléfono y se enviará a revisión cuando vuelva la conexión.'
                : 'Tu favor será revisado por un administrador antes de publicarse. Mientras tanto, solo tú puedes verlo en el muro.'}
            </Text>
            <AppButton label="Ver favores" onPress={irAFavores} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pasoTexto: { fontFamily: fonts.semiBold, fontSize: 14, marginTop: spacing.xs },
  progreso: { flexDirection: 'row', gap: 8, marginTop: spacing.sm, marginBottom: spacing.lg },
  barra: { flex: 1, height: 8, borderRadius: radius.pill },
  titulo: { fontSize: 26, fontFamily: fonts.bold, lineHeight: 32 },
  sub: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22, marginTop: 6, marginBottom: spacing.md },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  opcion: {
    width: '48.5%',
    minHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: 14,
    ...shadow,
  },
  opcionIcono: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  opcionTexto: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, marginTop: 10 },
  check: { position: 'absolute', top: 10, right: 10 },

  input: {
    minHeight: 120,
    borderRadius: radius.lg,
    padding: 16,
    fontSize: 17,
    fontFamily: fonts.regular,
    textAlignVertical: 'top',
    backgroundColor: colors.blanco,
    ...shadow,
  },
  charCount: { fontSize: 14, fontFamily: fonts.regular, textAlign: 'right', marginTop: 6 },
  urgenciaLabel: { fontSize: 16, fontFamily: fonts.semiBold, marginTop: spacing.sm, marginBottom: 8 },
  urgencias: { flexDirection: 'row', flexWrap: 'wrap' },
  urgenciaNota: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20, marginTop: spacing.xs },
  error: { color: colors.rojo, fontSize: 14, fontFamily: fonts.medium, lineHeight: 20, marginTop: spacing.sm },

  resumenRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  resumenTipo: { fontFamily: fonts.semiBold, fontSize: 14 },
  resumenTitulo: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, marginTop: 2 },

  loadingWrapper: { paddingVertical: spacing.md, alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 15, fontFamily: fonts.regular },

  overlay: { flex: 1, backgroundColor: 'rgba(19, 46, 102, 0.5)', justifyContent: 'center', padding: spacing.lg },
  tarjeta: { backgroundColor: colors.blanco, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'stretch' },
  modalIcono: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  tituloModal: { fontFamily: fonts.bold, fontSize: 22, textAlign: 'center', marginBottom: spacing.sm },
  textoModal: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, textAlign: 'center', marginBottom: spacing.sm },
});
