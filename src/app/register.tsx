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

const zonas = [
  'Castilla',
  'La Obrilla',
  'San Rafael',
  'San Vicente',
  'El Papayo',
  'Terela',
  'Chapayra',
  'Río Seco',
  'Miraflores',
  'Las Mercedes',
  'Loma El Mirador',
  'Cruz de Caña',
  'Virgen de Fátima',
  'Sector Chocán',
  'Mi Cautivo',
  'Los Pulache',
];

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
    <Screen scroll={true}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.titulo, { color: p.text }]}>Únete a tu Barrio</Text>
          <Text style={[styles.sub, { color: p.muted }]}>
            Conéctate con tus vecinos de forma cercana y segura.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: p.text }]}>Nombre y apellido</Text>
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

          <Text style={[styles.label, { color: p.text }]}>Centro poblado o zona</Text>
          <View style={styles.chips}>
            {zonas.map((z) => (
              <Chip key={z} label={z} selected={zona === z} onPress={() => setZona(z)} />
            ))}
          </View>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <AppButton label="Entrar al barrio" variant="accent" onPress={submit} disabled={!canSubmit} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  header: {
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  titulo: {
    fontSize: 28,
    fontFamily: fonts.bold,
    marginBottom: 6,
  },
  sub: {
    fontSize: 15,
    fontFamily: fonts.regular,
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    marginBottom: 8,
    marginTop: spacing.sm,
  },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: fonts.regular,
    marginBottom: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
});
