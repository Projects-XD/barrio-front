import { ActivityIndicator, FlatList, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { FavorCard } from '@/components/FavorCard';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useFavors } from '@/hooks/useData';
import { spacing } from '@/theme';

export default function Favores() {
  const p = usePalette();
  const { data, isLoading } = useFavors();

  return (
    <Screen scroll={false}>
      <Text style={[styles.titulo, { color: p.text }]}>Favores</Text>
      <Text style={[styles.sub, { color: p.muted }]}>Ayuda entre vecinos, sin dinero.</Text>
      <AppButton label="Publicar favor" onPress={() => router.push('/favores/nuevo')} />

      {isLoading ? (
        <ActivityIndicator color={p.primary} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FavorCard favor={item} />}
          ListEmptyComponent={
            <EmptyState title="Aún no hay favores" message="Publica el primero con el botón de arriba." />
          }
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: 28, fontWeight: '700', marginTop: 8 },
  sub: { fontSize: 16, marginBottom: spacing.md },
});
