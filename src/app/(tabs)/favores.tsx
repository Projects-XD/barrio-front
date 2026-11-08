import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { Chip } from '@/components/Chip';
import { EmergencyButton } from '@/components/EmergencyButton';
import { EmptyState } from '@/components/EmptyState';
import { FavorCard } from '@/components/FavorCard';
import { Screen } from '@/components/Screen';
import { SkeletonFavores } from '@/components/SkeletonFavores';
import { usePalette } from '@/hooks/usePalette';
import { useFavorsPage } from '@/hooks/useData';
import { favorTypeLabel } from '@/i18n/labels';
import type { FavorIntent, FavorType } from '@/types';
import { colors, fonts, radius, shadow, spacing } from '@/theme';

const tipos = Object.keys(favorTypeLabel) as FavorType[];

type TabFiltro = 'todos' | 'pedir' | 'ofrecer' | 'mias';

const TABS: { id: TabFiltro; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'todos', label: 'Todos', icon: 'grid-outline' },
  { id: 'pedir', label: 'Piden ayuda', icon: 'hand-left-outline' },
  { id: 'ofrecer', label: 'Ofrecen ayuda', icon: 'heart-outline' },
  { id: 'mias', label: 'Mis publicaciones', icon: 'person-outline' },
];

export default function FavoresScreen() {
  const p = usePalette();
  const [tabFiltro, setTabFiltro] = useState<TabFiltro>('todos');
  const [tipo, setTipo] = useState<FavorType | undefined>(undefined);
  const [pagina, setPagina] = useState(0);

  const intent: FavorIntent | undefined =
    tabFiltro === 'pedir' ? 'pedir' : tabFiltro === 'ofrecer' ? 'ofrecer' : undefined;
  const mine: boolean | undefined = tabFiltro === 'mias' ? true : undefined;

  const { data, isLoading, isError, error, refetch, isRefetching, isPlaceholderData } = useFavorsPage({
    type: tipo,
    intent,
    mine,
    page: pagina,
  });

  const favores = data?.items ?? [];

  const cambiarTab = (nuevoTab: TabFiltro) => {
    setTabFiltro(nuevoTab);
    setPagina(0);
  };

  const cambiarTipo = (t: FavorType | undefined) => {
    setTipo(t);
    setPagina(0);
  };

  const emptyTitle = () => {
    if (isError) return 'No pudimos cargar las publicaciones';
    if (tabFiltro === 'mias') return 'Aún no tienes publicaciones';
    if (tabFiltro === 'pedir') return tipo ? 'Sin pedidos en esta categoría' : 'No hay pedidos de ayuda activos';
    if (tabFiltro === 'ofrecer') return tipo ? 'Sin ofrecimientos en esta categoría' : 'No hay ofrecimientos activos';
    if (tipo) return 'Nada en esta categoría';
    return 'Aún no hay publicaciones en tu zona';
  };

  const emptyMessage = () => {
    if (isError) return (error as Error)?.message || 'Revisa tu conexión e inténtalo de nuevo.';
    if (tabFiltro === 'mias') return 'Aquí podrás ver y gestionar las ayudas que pidas u ofrezcas a tu barrio.';
    if (tabFiltro === 'pedir') return 'Cuando algún vecino necesite una herramienta o una mano, aparecerá aquí.';
    if (tabFiltro === 'ofrecer') return 'Sé el primero en compartir herramientas o brindar tu apoyo a la comunidad.';
    return 'Sé el primero en pedir una mano o en ofrecer algo que puedas compartir con tus vecinos.';
  };

  return (
    <Screen scroll={false}>
      {/* Cabecera */}
      <View style={styles.headerTop}>
        <Text style={[styles.titulo, { color: p.text }]}>Ayuda comunitaria</Text>
        <EmergencyButton />
      </View>
      <Text style={[styles.sub, { color: p.muted }]}>
        Pedidos y colaboraciones entre vecinos, sin dinero de por medio.
      </Text>

      {/* Botones de acción rápida: Pedir ayuda y Ofrecer ayuda */}
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pedir ayuda a vecinos"
          onPress={() => router.push('/favores/nuevo?modo=pedir')}
          style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: colors.naranjaSuave }]}>
            <Ionicons name="hand-left" size={20} color={colors.naranja} />
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={[styles.actionTitle, { color: p.text }]}>Pedir ayuda</Text>
            <Text style={[styles.actionDesc, { color: p.muted }]}>Necesito una mano</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.gris} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ofrecer ayuda a vecinos"
          onPress={() => router.push('/favores/nuevo?modo=ofrecer')}
          style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: colors.verdeExitoSuave }]}>
            <Ionicons name="heart" size={20} color={colors.verdeExito} />
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={[styles.actionTitle, { color: p.text }]}>Ofrecer ayuda</Text>
            <Text style={[styles.actionDesc, { color: p.muted }]}>Puedo colaborar</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.gris} />
        </Pressable>
      </View>

      {/* Selector de orden / filtro principal: Todos | Piden ayuda | Ofrecen ayuda | Mis publicaciones */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabScrollContent}
      >
        {TABS.map((tab) => {
          const selected = tabFiltro === tab.id;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => cambiarTab(tab.id)}
              style={[
                styles.tabItem,
                selected
                  ? { backgroundColor: colors.azul, borderColor: colors.azul }
                  : { backgroundColor: colors.blanco, borderColor: p.border },
              ]}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={selected ? colors.blanco : p.text}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: selected ? colors.blanco : p.text,
                    fontFamily: selected ? fonts.bold : fonts.medium,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Chips de sub-categoría */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
        contentContainerStyle={{ paddingRight: 8 }}
      >
        <Chip label="Todas las categorías" selected={!tipo} onPress={() => cambiarTipo(undefined)} />
        {tipos.map((t) => (
          <Chip
            key={t}
            label={favorTypeLabel[t]}
            selected={tipo === t}
            onPress={() => cambiarTipo(t)}
          />
        ))}
      </ScrollView>

      {/* Lista de tarjetas */}
      {isLoading ? (
        <SkeletonFavores count={4} />
      ) : (
        <FlatList
          data={favores}
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
            <View>
              <EmptyState
                icon={
                  isError
                    ? 'cloud-offline-outline'
                    : tabFiltro === 'mias'
                      ? 'person-outline'
                      : tabFiltro === 'ofrecer'
                        ? 'heart-outline'
                        : tabFiltro === 'pedir'
                          ? 'hand-left-outline'
                          : 'help-buoy-outline'
                }
                title={emptyTitle()}
                message={emptyMessage()}
              />
              {isError ? (
                <AppButton label="Reintentar" variant="secondary" icon="refresh" onPress={() => refetch()} />
              ) : tabFiltro === 'mias' ? (
                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
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
              ) : null}
            </View>
          }
          contentContainerStyle={{ paddingBottom: spacing.md, paddingTop: spacing.xs }}
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  titulo: { fontSize: 28, fontFamily: fonts.bold },
  sub: { fontSize: 15, fontFamily: fonts.regular, marginTop: 4, marginBottom: spacing.sm },

  // Tarjetas de acción
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blanco,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.grisBorde,
    ...shadow,
  },
  actionCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  actionDesc: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
  },

  // Tabs de filtro principal
  tabScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: spacing.xs,
  },
  tabScrollContent: {
    paddingRight: 8,
    gap: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  tabLabel: {
    fontSize: 14,
  },

  // Chips de sub-categoría
  chips: { flexGrow: 0, flexShrink: 0, marginBottom: spacing.xs },

  // Paginación
  paginacion: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  paginaBtn: { flex: 1 },
  paginaNum: { fontSize: 14, fontFamily: fonts.medium },
});
