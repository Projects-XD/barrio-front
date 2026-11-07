import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, radius, spacing } from '@/theme';
import { ZONE_ID } from '@/data/mock';

const zonas = ['Centro', 'Los Álamos', 'La Plaza', 'Villa Norte', 'San Isidro'];

export default function Register() {
  const p = usePalette();
  const setSession = useAppStore((s) => s.setSession);
  const [nombre, setNombre] = useState('');
  const [zona, setZona] = useState<string | null>(zonas[0]);

  const canSubmit = nombre.trim().length > 1 && zona !== null;

  const submit = () => {
    setSession({ token: 'mock-token', userId: 'me', zoneId: ZONE_ID });
    router.replace('/(tabs)/inicio');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.titulo, { color: p.text }]}>Únete a tu Barrio</Text>
        <Text style={[styles.sub, { color: p.muted }]}>
          Identifícate con tus vecinos para pedir favores y recomendar oficios de confianza.
        </Text>
      </View>

      <Text style={[styles.label, { color: p.text }]}>Tu nombre y apellido</Text>
      <TextInput
        value={nombre}
        onChangeText={setNombre}
        placeholder="Ej. Alexander García"
        placeholderTextColor={colors.gris}
        style={[
          styles.input,
          { borderColor: p.border, color: p.text, backgroundColor: colors.blanco },
        ]}
      />

      <Text style={[styles.label, { color: p.text }]}>Selecciona tu zona o barrio</Text>
      <Text style={[styles.helper, { color: p.muted }]}>
        Solo verás y publicarás para vecinos de tu misma zona.
      </Text>
      <View style={styles.chips}>
        {zonas.map((z) => (
          <Chip key={z} label={z} selected={zona === z} onPress={() => setZona(z)} />
        ))}
      </View>

      <View style={styles.garantiaCard}>
        <Text style={styles.garantiaTitulo}>Privacidad vecinal</Text>
        <Text style={styles.garantiaTexto}>
          Tus datos se usan únicamente dentro de tu barrio. Las direcciones exactas nunca se publican abiertamente.
        </Text>
      </View>

      <View style={styles.garantiaCard}>
        <Text style={styles.garantiaTitulo}>🔒 Privacidad vecinal</Text>
        <Text style={styles.garantiaTexto}>
          Tus datos se usan únicamente dentro de tu barrio. Las direcciones exactas nunca se publican abiertamente.
        </Text>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <AppButton
          label="Entrar al barrio"
          variant="accent"
          onPress={submit}
          disabled={!canSubmit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.md, marginTop: spacing.sm },
  titulo: { fontSize: 28, fontFamily: fonts.bold, marginBottom: 8 },
  sub: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22 },
  label: { fontSize: 16, fontFamily: fonts.semiBold, marginTop: spacing.md, marginBottom: 6 },
  helper: { fontSize: 14, fontFamily: fonts.regular, marginBottom: spacing.sm },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    fontSize: 17,
    fontFamily: fonts.regular,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  garantiaCard: {
    backgroundColor: '#E0ECFB',
    borderRadius: radius.md,
    padding: 16,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: '#BDD7F5',
  },
  garantiaTitulo: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.azul,
    marginBottom: 4,
  },
  garantiaTexto: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.carbon,
    lineHeight: 20,
  },
});
