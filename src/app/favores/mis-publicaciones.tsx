import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { FavorCard } from '@/components/FavorCard';
import { Screen } from '@/components/Screen';
import { SkeletonFavores } from '@/components/SkeletonFavores';
import { usePalette } from '@/hooks/usePalette';
import { useFavorsPage } from '@/hooks/useData';
import { useAppStore } from '@/store/app-store';
import type { FavorIntent } from '@/types';
import { colors, fonts, radius, spacing } from '@/theme';

type TabMine = 'todas' | 'pedir' | 'ofrecer';

const TABS: { id: TabMine; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'pedir', label: 'Mis pedidos' },
  { id: 'ofrecer', label: 'Mis ofrecimientos' },
];

export default function MisPublicacionesScreen() {
  const p = usePalette();
  const userId = useAppStore((s) => s.userId);
  const [tab, setTab] = useState<TabMine>('todas');
  const [pagina, setPagina] = useState(0);

  const intent: FavorIntent | undefined =
    tab === 'pedir' ? 'pedir' : tab === 'ofrecer' ? 'ofrecer' : undefined;

  const { data, isLoading, isError, error, refetch, isRefetching, isPlaceholderData } = useFavorsPage({
    type: undefined,
    intent,
    mine: true,
    page: pagina,
  });

  const publicaciones = (data?.items ?? []).filter((item) => !userId || item.authorId === userId);

  const cambiarTab = (nuevoTab: TabMine) => {
    setTab(nuevoTab);
    setPagina(0);
  };

  return (
    <Screen scroll={false}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Mis aportes',
          headerBackTitle: 'Atrás',
        }}
      />

      {/* Selector de pestañas minimalista */}
      <View style={styles.segmentContainer}>
        {TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => cambiarTab(t.id)}
              style={[
                styles.segmentBtn,
                selected && styles.segmentBtnSelected,
              ]}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  {
                    color: selected ? colors.azul : p.muted,
                    fontFamily: selected ? fonts.bold : fonts.medium,
                  },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Lista de publicaciones propias */}
      {isLoading ? (
        <SkeletonFavores count={3} />
      ) : (
        <FlatList
          data={publicaciones}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <FavorCard
              favor={item}
              onPress={item.syncStatus === 'enviado' ? () => router.push(`/favores/${item.id}`) : undefined}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <EmptyState
                icon="folder-open-outline"
                title={
                  isError
                    ? 'No pudimos cargar tus aportes'
                    : tab === 'pedir'
                      ? 'No tienes pedidos de ayuda activos'
                      : tab === 'ofrecer'
                        ? 'No tienes ofrecimientos activos'
                        : 'Aún no tienes aportes'
                }
                message={
                  isError
                    ? (error as Error)?.message || 'Revisa tu conexión e inténtalo de nuevo.'
                    : 'Cuando pidas ayuda o compartas algo con tus vecinos, podrás gestionarlo aquí.'
                }
              />
              <View style={styles.emptyActions}>
                <AppButton
                  label="Pedir ayuda"
                  icon="hand-left-outline"
                  onPress={() => router.push('/favores/nuevo?modo=pedir')}
                />
                <AppButton
                  label="Ofrecer ayuda"
                  variant="secondary"
                  icon="heart-outline"
                  onPress={() => router.push('/favores/nuevo?modo=ofrecer')}
                />
              </View>
            </View>
          }
          contentContainerStyle={{ paddingBottom: spacing.lg, paddingTop: spacing.xs }}
          ListFooterComponent={
            pagina > 0 || data?.hasNext ? (
              <View style={styles.paginacion}>
                <View style={styles.paginaBtn}>
                  <AppButton
                    label="Anterior"
                    variant="secondary"
                    icon="chevron-back"
                    disabled={pagina === 0 || isPlaceholderData}
                    onPress={() => setPagina((n) => Math.max(0, n - 1))}
                  />
                </View>
                <Text style={[styles.paginaNum, { color: p.muted }]}>Página {pagina + 1}</Text>
                <View style={styles.paginaBtn}>
                  <AppButton
                    label="Siguiente"
                    variant="secondary"
                    icon="chevron-forward"
                    disabled={!data?.hasNext || isPlaceholderData}
                    onPress={() => setPagina((n) => n + 1)}
                  />
                </View>
              </View>
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.azulSuave,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentBtnSelected: {
    backgroundColor: colors.blanco,
    shadowColor: '#132E66',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 13,
  },
  emptyContainer: {
    paddingVertical: spacing.md,
  },
  emptyActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  paginacion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  paginaBtn: { flex: 1 },
  paginaNum: { fontSize: 14, fontFamily: fonts.medium },
});
