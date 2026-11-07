import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useCreateFavor } from '@/hooks/useData';
import { favorTypeIcon } from '@/i18n/icons';
import { favorTypeLabel } from '@/i18n/labels';
import type { FavorType } from '@/types';
import { colors, fonts, radius, shadow, spacing } from '@/theme';

const tipos = Object.keys(favorTypeLabel) as FavorType[];

const PASOS = ['Elige el tipo', 'Escribe tu favor', 'Revisa y publica'];

export default function NuevoFavor() {
  const p = usePalette();
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<FavorType | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [texto, setTexto] = useState('');
  const crear = useCreateFavor();

  const publicar = async () => {
    if (!tipo || !texto.trim() || crear.isPending) return;

    try {
      const { queued } = await crear.mutateAsync({
        type: tipo,
        title: texto.trim(),
        description: null,
      });

      // Navegar de inmediato: en web Alert no ejecuta sus botones, así que no depende de ellos.
      router.replace('/(tabs)/favores');
      Alert.alert(
        queued ? 'Guardado sin conexión' : '¡Favor publicado!',
        queued
          ? 'Tu favor se guardó en el teléfono y se publicará solo cuando vuelva la conexión.'
          : 'Tu publicación ya está disponible en el muro de favores de tu barrio.',
        [{ text: 'Entendido' }]
      );
    } catch (err: any) {
      const errorMsg = err?.message || 'No se pudo publicar el favor. Verifica tu conexión con el servidor.';
      Alert.alert('Error al publicar favor', errorMsg);
    }
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
          <Text style={[styles.titulo, { color: p.text }]}>¿Qué necesitas o qué ofreces?</Text>
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
                  <Text style={[styles.opcionTexto, { color: p.text }]}>{favorTypeLabel[t]}</Text>
                  {activo ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.verdeExito} style={styles.check} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <View style={{ marginTop: spacing.md }}>
            <AppButton label="Siguiente" icon="arrow-forward" onPress={() => setPaso(2)} disabled={!tipo} />
          </View>
        </>
      )}

      {paso === 2 && (
        <>
          <Text style={[styles.titulo, { color: p.text }]}>
            {tipo === 'otros' ? '¿Qué otro favor necesitas u ofreces?' : 'Describe tu favor en una línea'}
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
                <Text style={[styles.resumenTipo, { color: p.muted }]}>{favorTypeLabel[tipo]}</Text>
                <Text style={[styles.resumenTitulo, { color: p.text }]}>{texto.trim()}</Text>
              </View>
            </View>
          </Card>

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
            <Text style={[styles.textoModal, { color: p.muted }]}>Lo verán los vecinos de tu zona.</Text>
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
