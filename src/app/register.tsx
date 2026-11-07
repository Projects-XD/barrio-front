import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useAppStore } from '@/store/app-store';
import { fonts, colors, radius, spacing } from '@/theme';
import { ZONE_ID } from '@/data/mock';

const zonas = [
  'Castilla', 'La Obrilla', 'San Rafael', 'San Vicente', 'El Papayo', 'Terela', 'Chapayra',
  'Río Seco', 'Miraflores', 'Las Mercedes', 'Loma El Mirador', 'Cruz de Caña', 'Virgen de Fátima',
  'Sector Chocán', 'Mi Cautivo', 'Los Pulache',
];

export default function Register() {
  const p = usePalette();
  const setSession = useAppStore((s) => s.setSession);
  const [nombre, setNombre] = useState('');
  const [zona, setZona] = useState<string | null>(null);

  const canSubmit = nombre.trim().length > 1 && zona !== null;

  const submit = () => {
    setSession({ token: 'mock-token', userId: 'me', zoneId: ZONE_ID });
    router.replace('/(tabs)/inicio');
  };

  return (
    <Screen>
      <Text style={[styles.titulo, { color: p.text }]}>Crea tu perfil</Text>
      <Text style={[styles.sub, { color: p.muted }]}>Solo te pedimos lo necesario para empezar.</Text>

      <Text style={[styles.label, { color: p.text }]}>Nombre</Text>
      <TextInput
        value={nombre}
        onChangeText={setNombre}
        placeholder="Tu nombre"
        style={[styles.input, { borderColor: p.border }]}
      />

      <Text style={[styles.label, { color: p.text }]}>Centro poblado</Text>
      <View style={styles.chips}>
        {zonas.map((z) => (
          <Chip key={z} label={z} selected={zona === z} onPress={() => setZona(z)} />
        ))}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <AppButton label="Entrar al barrio" onPress={submit} disabled={!canSubmit} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: 28, fontFamily: fonts.bold, marginBottom: 8 },
  sub: { fontFamily: fonts.regular, fontSize: 16, marginBottom: spacing.md },
  label: { fontSize: 16, fontFamily: fonts.semibold, marginTop: spacing.md, marginBottom: 6 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    fontFamily: fonts.regular, fontSize: 18,
    backgroundColor: colors.blanco,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
