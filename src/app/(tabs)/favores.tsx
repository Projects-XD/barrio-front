import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { FavorCard } from '@/components/FavorCard';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useFavors } from '@/hooks/useData';
import { favorTypeLabel } from '@/i18n/labels';
import type { FavorType } from '@/types';
import { fonts, radius, spacing } from '@/theme';

const tipos = Object.keys(favorTypeLabel) as FavorType[];

export default function Favores() {
  const p = usePalette();
  const [filtro, setFiltro] = useState<FavorType | undefined>(undefined);
  const { data, isLoading, isError, error, refetch, isRefetching } = useFavors(filtro);

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

      {/* Filtros horizontales por tipo de favor */}
      <View style={styles.chipsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['todos', ...tipos] as (FavorType | 'todos')[]}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Chip
              label={item === 'todos' ? 'Todos' : favorTypeLabel[item]}
              selected={item === 'todos' ? !filtro : filtro === item}
              onPress={() => setFiltro(item === 'todos' ? undefined : item)}
            />
          )}
          contentContainerStyle={styles.chipsList}
        />
      </View>

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
              onPress={() => router.push(`/favores/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <EmptyState
                title={isError ? 'Error al cargar favores' : 'No hay favores en esta categoría'}
                message={
                  isError
                    ? (error as Error)?.message || 'No se pudo conectar con el servidor.'
                    : filtro
                      ? 'Prueba seleccionando otra categoría o publica un nuevo favor.'
                      : 'Sé el primero en solicitar o brindar apoyo con el botón de arriba.'
                }
              />
              {isError || filtro ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={isError ? () => refetch() : () => setFiltro(undefined)}
                  style={[styles.retryBtn, { borderColor: p.primary }]}
                >
                  <Text style={[styles.retryText, { color: p.primary }]}>
                    {isError ? 'Reintentar conexión' : 'Ver todos los favores'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          }
          contentContainerStyle={{ paddingBottom: spacing.xl, paddingTop: spacing.xs }}
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
    marginBottom: spacing.xs,
  },
  chipsContainer: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  chipsList: {
    paddingVertical: 2,
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
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  retryText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },
});
