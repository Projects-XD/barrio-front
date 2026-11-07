import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { FavorCard } from '@/components/FavorCard';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useFavors } from '@/hooks/useData';
import { fonts, spacing } from '@/theme';

export default function Favores() {
  const p = usePalette();
  const { data, isLoading, isError, error, refetch, isRefetching } = useFavors();

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <Text style={[styles.titulo, { color: p.text }]}>Muro de Favores</Text>
        <Text style={[styles.sub, { color: p.muted }]}>
          Ayuda mutua y solidaridad comunitaria entre vecinos, sin dinero.
        </Text>
      </View>

      <AppButton
        label="Publicar nuevo favor"
        variant="accent"
        onPress={() => router.push('/favores/nuevo')}
      />

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={p.primary} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <FavorCard
              favor={item}
              onPress={item.syncStatus === 'enviado' ? () => router.push(`/favores/${item.id}`) : undefined}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <EmptyState
                title={isError ? 'Error al cargar favores' : 'Aún no hay favores en tu zona'}
                message={
                  isError
                    ? (error as Error)?.message || 'No se pudo conectar con el servidor.'
                    : 'Sé el primero en solicitar o brindar apoyo con el botón de arriba.'
                }
              />
              {isError ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => refetch()}
                  style={[styles.retryBtn, { borderColor: p.primary }]}
                >
                  <Text style={[styles.retryText, { color: p.primary }]}>Reintentar conexión</Text>
                </Pressable>
              ) : null}
            </View>
          }
          contentContainerStyle={{ paddingBottom: spacing.xl, paddingTop: spacing.sm }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  titulo: {
    fontSize: 26,
    fontFamily: fonts.bold,
    marginBottom: 4,
  },
  sub: {
    fontSize: 15,
    fontFamily: fonts.regular,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  retryBtn: {
    marginTop: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },
});
