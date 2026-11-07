import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useCreateFavor } from '@/hooks/useData';
import { favorTypeIcon } from '@/i18n/icons';
import { favorTypeLabel } from '@/i18n/labels';
import type { FavorType } from '@/types';
import { colors, fonts, radius, spacing } from '@/theme';

const tipos = Object.keys(favorTypeLabel) as FavorType[];

const tipoSubtitulo: Record<FavorType, string> = {
  herramienta: 'Escalera, taladro, llaves o equipos por unas horas.',
  ayuda_temporal: 'Mover un mueble, cuidar una mascota o apoyo puntual.',
  donacion_materiales: 'Libros, materiales de obra o artículos en buen estado.',
  intercambio_habilidades: 'Trueque de conocimientos o reparaciones entre vecinos.',
  movilidad_solidaria: 'Compartir asientos libres hacia centros médicos o el centro.',
  otros: 'Cualquier otra solicitud u oferta solidaria para tu barrio.',
};

export default function NuevoFavor() {
  const p = usePalette();
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<FavorType | null>(null);
  const [titulo, setTitulo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const crear = useCreateFavor();

  const publicar = async () => {
    if (!tipo || !titulo.trim() || crear.isPending) return;
    setErrorMsg(null);

    try {
      const { favorId } = await crear.mutateAsync({
        type: tipo,
        title: titulo.trim(),
        description: detalle.trim() ? detalle.trim() : null,
      });

      // Redirigir directamente al detalle del favor creado o al muro de favores
      if (favorId) {
        router.replace(`/favores/${favorId}`);
      } else {
        router.replace('/(tabs)/favores');
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          'No se pudo publicar el favor. Verifica tu conexión con el servidor.'
      );
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

      {errorMsg ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {paso === 1 && (
        <>
          <Text style={[styles.titulo, { color: p.text }]}>
            ¿Qué necesitas o qué ofreces?
          </Text>
          <Text style={[styles.sub, { color: p.muted }]}>
            Selecciona la categoría solidaria que mejor describe tu favor.
          </Text>

          <View style={styles.optionsList}>
            {tipos.map((t) => {
              const selected = tipo === t;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setTipo(t)}
                  style={[
                    styles.optionCard,
                    selected ? styles.optionCardSelected : styles.optionCardDefault,
                  ]}
                >
                  <View
                    style={[
                      styles.optionIconWrap,
                      { backgroundColor: selected ? p.primary : '#EEF5FD' },
                    ]}
                  >
                    <Ionicons
                      name={favorTypeIcon[t]}
                      size={20}
                      color={selected ? colors.blanco : p.primary}
                    />
                  </View>
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.opcion, { color: p.text }]}>
                      {favorTypeLabel[t]}
                    </Text>
                    <Text style={styles.opcionSub}>{tipoSubtitulo[t]}</Text>
                  </View>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={selected ? p.primary : '#CBD5E1'}
                  />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.buttonsStack}>
            <AppButton
              label="Continuar"
              variant="accent"
              onPress={() => setPaso(2)}
              disabled={!tipo}
            />
            <AppButton
              label="Cancelar"
              variant="secondary"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/(tabs)/favores')
              }
            />
          </View>
        </>
      )}

      {paso === 2 && (
        <>
          <Text style={[styles.titulo, { color: p.text }]}>
            {tipo === 'otros'
              ? '¿Qué favor necesitas u ofreces?'
              : 'Describe tu favor para el barrio'}
          </Text>
          <Text style={[styles.sub, { color: p.muted }]}>
            Sé claro y específico para que tus vecinos de la zona puedan ayudarte.
          </Text>

          <Text style={[styles.fieldLabel, { color: p.text }]}>
            Título breve (obligatorio)
          </Text>
          <TextInput
            value={titulo}
            onChangeText={setTitulo}
            placeholder={
              tipo === 'otros'
                ? 'Ej: Busco vecino que me oriente para trámites en celular'
                : 'Ej: Necesito prestada una escalera de tijera este sábado'
            }
            placeholderTextColor={colors.gris}
            maxLength={120}
            style={[
              styles.inputShort,
              { borderColor: p.border, color: p.text, backgroundColor: colors.blanco },
            ]}
          />
          <Text style={[styles.charCount, { color: p.muted }]}>
            {titulo.trim().length}/120 caracteres
          </Text>

          <Text style={[styles.fieldLabel, { color: p.text }]}>
            Detalles adicionales o referencia (opcional)
          </Text>
          <TextInput
            value={detalle}
            onChangeText={setDetalle}
            placeholder="Ej: La necesito solo de 9am a 11am para limpiar la canaleta. Estoy frente al parque."
            placeholderTextColor={colors.gris}
            multiline
            maxLength={350}
            style={[
              styles.input,
              { borderColor: p.border, color: p.text, backgroundColor: colors.blanco },
            ]}
          />

          <View style={styles.buttonsStack}>
            <AppButton
              label="Revisar publicación"
              variant="accent"
              onPress={() => setPaso(3)}
              disabled={titulo.trim().length < 5}
            />
            <AppButton
              label="Atrás"
              variant="secondary"
              onPress={() => setPaso(1)}
            />
          </View>
        </>
      )}

      {paso === 3 && tipo && (
        <>
          <Text style={[styles.titulo, { color: p.text }]}>
            Confirma tu publicación
          </Text>
          <Text style={[styles.sub, { color: p.muted }]}>
            Se publicará en el muro solidario de tu zona sin transacciones de dinero.
          </Text>

          <Card>
            <Text style={styles.previewCategory}>{favorTypeLabel[tipo]}</Text>
            <Text style={[styles.previewTitle, { color: p.text }]}>
              {titulo.trim()}
            </Text>
            {detalle.trim() ? (
              <Text style={styles.previewDetail}>{detalle.trim()}</Text>
            ) : null}
          </Card>

          <View style={styles.buttonsStack}>
            {crear.isPending ? (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator size="large" color={p.primary} />
                <Text style={[styles.loadingText, { color: p.muted }]}>
                  Publicando tu favor en el barrio...
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
                <AppButton
                  label="Atrás"
                  variant="secondary"
                  onPress={() => setPaso(2)}
                />
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
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: '#991B1B',
  },
  titulo: {
    fontSize: 24,
    fontFamily: fonts.bold,
    marginBottom: 4,
  },
  sub: {
    fontSize: 14.5,
    fontFamily: fonts.regular,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  optionsList: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.blanco,
  },
  optionCardDefault: {
    borderWidth: 1,
    borderColor: colors.grisBorde,
  },
  optionCardSelected: {
    borderWidth: 2,
    borderColor: colors.azul,
    backgroundColor: '#F8FBFF',
  },
  optionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextWrap: {
    flex: 1,
  },
  opcion: {
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  opcionSub: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 17,
  },
  fieldLabel: {
    fontSize: 14.5,
    fontFamily: fonts.semiBold,
    marginBottom: 6,
    marginTop: spacing.xs,
  },
  inputShort: {
    minHeight: 50,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  input: {
    minHeight: 100,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 15.5,
    fontFamily: fonts.regular,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    fontFamily: fonts.regular,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: spacing.xs,
  },
  previewCategory: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.azul,
    marginBottom: 4,
  },
  previewTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  previewDetail: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#334155',
    marginTop: 8,
    lineHeight: 21,
  },
  buttonsStack: {
    marginTop: spacing.lg,
    gap: 10,
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
