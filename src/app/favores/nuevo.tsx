import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useCreateFavor } from '@/hooks/useData';
import { favorTypeBackground, favorTypeLabel } from '@/i18n/labels';
import type { FavorType } from '@/types';
import { colors, fonts, radius, spacing } from '@/theme';

const tipos = Object.keys(favorTypeLabel) as FavorType[];

export default function NuevoFavor() {
  const p = usePalette();
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<FavorType | null>(null);
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

      Alert.alert(
        queued ? 'Guardado sin conexión' : '¡Favor publicado!',
        queued
          ? 'Tu favor se guardó en el teléfono y se publicará solo cuando vuelva la conexión.'
          : 'Tu publicación ya está disponible en el muro de favores de tu barrio.',
        [{ text: 'Entendido', onPress: () => router.back() }]
      );
    } catch (err: any) {
      const errorMsg =
        err?.message ||
        'No se pudo publicar el favor. Verifica tu conexión con el servidor.';
      Alert.alert('Error al publicar favor', errorMsg);
    }
  };

  return (
    <Screen>
      <View style={styles.progreso}>
        {[1, 2, 3].map((n) => (
          <View
            key={n}
            style={[
              styles.barra,
              { backgroundColor: n <= paso ? p.primary : p.border },
            ]}
          />
        ))}
      </View>

      {paso === 1 && (
        <>
          <Text style={[styles.titulo, { color: p.text }]}>¿Qué necesitas o qué ofreces?</Text>
          <Text style={[styles.sub, { color: p.muted }]}>
            Selecciona la categoría solidaria que mejor describe tu favor.
          </Text>
          {tipos.map((t) => (
            <Card
              key={t}
              backgroundColor={tipo === t ? colors.verdeSuave : favorTypeBackground[t]}
              onPress={() => setTipo(t)}
            >
              <Text style={[styles.opcion, { color: p.text }]}>{favorTypeLabel[t]}</Text>
            </Card>
          ))}
          <View style={{ marginTop: spacing.md }}>
            <AppButton label="Siguiente" variant="accent" onPress={() => setPaso(2)} disabled={!tipo} />
          </View>
        </>
      )}

      {paso === 2 && (
        <>
          <Text style={[styles.titulo, { color: p.text }]}>
            {tipo === 'otros' ? '¿Qué otro favor necesitas u ofreces?' : 'Describe en una línea'}
          </Text>
          <Text style={[styles.sub, { color: p.muted }]}>
            {tipo === 'otros'
              ? 'Escribe con tus palabras qué necesitas o qué puedes ofrecer. Tus vecinos verán tu mensaje tal cual.'
              : 'Sé claro y específico para que tus vecinos puedan ayudarte rápidamente.'}
          </Text>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder={
              tipo === 'otros'
                ? 'Ej: Necesito que alguien me enseñe a usar una computadora'
                : 'Ej: Necesito prestada una escalera este sábado...'
            }
            placeholderTextColor={colors.gris}
            multiline
            maxLength={120}
            style={[
              styles.input,
              { borderColor: p.border, color: p.text, backgroundColor: colors.blanco },
            ]}
          />
          <Text style={[styles.charCount, { color: p.muted }]}>
            {texto.trim().length}/120 caracteres
          </Text>

          <View style={{ marginTop: spacing.md }}>
            <AppButton
              label="Siguiente"
              variant="accent"
              onPress={() => setPaso(3)}
              disabled={texto.trim().length < 3}
            />
            <AppButton label="Atrás" variant="secondary" onPress={() => setPaso(1)} />
          </View>
        </>
      )}

      {paso === 3 && tipo && (
        <>
          <Text style={[styles.titulo, { color: p.text }]}>Confirma tu publicación</Text>
          <Text style={[styles.sub, { color: p.muted }]}>
            Se publicará en tu zona sin transacciones de dinero.
          </Text>
          <Card backgroundColor={favorTypeBackground[tipo]}>
            <Text style={{ color: p.muted, fontSize: 14, fontFamily: fonts.medium }}>
              {favorTypeLabel[tipo]}
            </Text>
            <Text style={[styles.opcion, { color: p.text, marginTop: 4 }]}>
              {texto.trim()}
            </Text>
          </Card>

          <View style={{ marginTop: spacing.md }}>
            {crear.isPending ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator size="large" color={p.primary} />
                <Text style={[styles.loadingText, { color: p.muted }]}>
                  Publicando tu favor...
                </Text>
              </View>
            ) : (
              <>
                <AppButton
                  label="Publicar en el barrio"
                  variant="accent"
                  onPress={publicar}
                  disabled={crear.isPending}
                />
                <AppButton label="Atrás" variant="secondary" onPress={() => setPaso(2)} />
              </>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progreso: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  barra: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
  },
  titulo: {
    fontSize: 24,
    fontFamily: fonts.bold,
    marginBottom: 4,
  },
  sub: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  opcion: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
  },
  input: {
    minHeight: 110,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 16,
    fontFamily: fonts.regular,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    fontFamily: fonts.regular,
    textAlign: 'right',
    marginTop: 4,
  },
  loadingWrapper: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: fonts.regular,
  },
});
