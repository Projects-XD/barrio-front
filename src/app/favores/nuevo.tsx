import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useCreateFavor } from '@/hooks/useData';
import { favorTypeBackground, favorTypeLabel } from '@/i18n/labels';
import type { FavorType } from '@/types';
import { colors, radius, spacing } from '@/theme';

const tipos = Object.keys(favorTypeLabel) as FavorType[];

export default function NuevoFavor() {
  const p = usePalette();
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<FavorType | null>(null);
  const [texto, setTexto] = useState('');
  const crear = useCreateFavor();

  const publicar = () => {
    if (!tipo) return;
    crear.mutate(
      { type: tipo, title: texto.trim(), description: null },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Screen>
      <View style={styles.progreso}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[styles.barra, { backgroundColor: n <= paso ? p.primary : p.border }]} />
        ))}
      </View>

      {paso === 1 && (
        <>
          <Text style={[styles.titulo, { color: p.text }]}>¿Qué necesitas o qué ofreces?</Text>
          {tipos.map((t) => (
            <Card key={t} backgroundColor={tipo === t ? colors.verdeSuave : favorTypeBackground[t]} onPress={() => setTipo(t)}>
              <Text style={[styles.opcion, { color: p.text }]}>{favorTypeLabel[t]}</Text>
            </Card>
          ))}
          <AppButton label="Siguiente" onPress={() => setPaso(2)} disabled={!tipo} />
        </>
      )}

      {paso === 2 && (
        <>
          <Text style={[styles.titulo, { color: p.text }]}>Describe en una línea</Text>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Ej: Necesito una escalera el sábado"
            multiline
            style={[styles.input, { borderColor: p.border }]}
          />
          <AppButton label="Siguiente" onPress={() => setPaso(3)} disabled={texto.trim().length < 3} />
          <AppButton label="Atrás" variant="secondary" onPress={() => setPaso(1)} />
        </>
      )}

      {paso === 3 && tipo && (
        <>
          <Text style={[styles.titulo, { color: p.text }]}>Confirma</Text>
          <Card backgroundColor={favorTypeBackground[tipo]}>
            <Text style={{ color: p.muted, fontSize: 14 }}>{favorTypeLabel[tipo]}</Text>
            <Text style={[styles.opcion, { color: p.text }]}>{texto.trim()}</Text>
          </Card>
          <AppButton label="Publicar" onPress={publicar} disabled={crear.isPending} />
          <AppButton label="Atrás" variant="secondary" onPress={() => setPaso(2)} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progreso: { flexDirection: 'row', gap: 8, marginBottom: spacing.lg, marginTop: spacing.sm },
  barra: { flex: 1, height: 8, borderRadius: 4 },
  titulo: { fontSize: 24, fontWeight: '700', marginBottom: spacing.md },
  opcion: { fontSize: 18, fontWeight: '600' },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 18,
    backgroundColor: colors.blanco,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
});
