import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

type TabFiltro = 'todos' | 'pedir' | 'ofrecer';

const TABS: { id: TabFiltro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'pedir', label: 'Piden ayuda' },
  { id: 'ofrecer', label: 'Ofrecen ayuda' },
];

export default function FavoresScreen() {
  const p = usePalette();
  const [tabFiltro, setTabFiltro] = useState<TabFiltro>('todos');
  const [tipo, setTipo] = useState<FavorType | undefined>(undefined);
  const [pagina, setPagina] = useState(0);
  const [modalPublicar, setModalPublicar] = useState(false);

  const intent: FavorIntent | undefined =
    tabFiltro === 'pedir' ? 'pedir' : tabFiltro === 'ofrecer' ? 'ofrecer' : undefined;

  const { data, isLoading, isError, error, refetch, isRefetching, isPlaceholderData } = useFavorsPage({
    type: tipo,
    intent,
    mine: undefined,
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

  const irACrear = (modo: 'pedir' | 'ofrecer') => {
    setModalPublicar(false);
    router.push(`/favores/nuevo?modo=${modo}`);
  };

  const emptyTitle = () => {
    if (isError) return 'No pudimos cargar las publicaciones';
    if (tabFiltro === 'pedir') return tipo ? 'Sin pedidos en esta categoría' : 'No hay pedidos de ayuda activos';
    if (tabFiltro === 'ofrecer') return tipo ? 'Sin ofrecimientos en esta categoría' : 'No hay ofrecimientos activos';
    if (tipo) return 'Nada en esta categoría';
    return 'Aún no hay publicaciones en tu zona';
  };

  const emptyMessage = () => {
    if (isError) return (error as Error)?.message || 'Revisa tu conexión e inténtalo de nuevo.';
    if (tabFiltro === 'pedir') return 'Cuando algún vecino necesite una herramienta o una mano, aparecerá aquí.';
    if (tabFiltro === 'ofrecer') return 'Sé el primero en compartir herramientas o brindar tu apoyo a la comunidad.';
    return 'Sé el primero en pedir una mano o en ofrecer algo que puedas compartir con tus vecinos.';
  };

  return (
    <Screen scroll={false}>
      {/* Cabecera limpia */}
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.titulo, { color: p.text }]}>Ayuda comunitaria</Text>
          <Text style={[styles.sub, { color: p.muted }]}>Colaboración solidaria entre vecinos</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ir a mis publicaciones"
            onPress={() => router.push('/favores/mis-publicaciones')}
            style={({ pressed }) => [styles.misPubsBtn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="folder-outline" size={15} color={colors.azul} />
            <Text style={styles.misPubsText}>Mis ayudas</Text>
          </Pressable>
          <EmergencyButton />
        </View>
      </View>

      {/* Barra de acción única para publicar (sin ruido de tarjetas permanentes) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Publicar ayuda"
        onPress={() => setModalPublicar(true)}
        style={({ pressed }) => [styles.publishBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
      >
        <Ionicons name="add-circle" size={19} color={colors.blanco} />
        <Text style={styles.publishBtnText}>Publicar ayuda</Text>
      </Pressable>

      {/* Selector de pestañas minimalista tipo segmento */}
      <View style={styles.segmentContainer}>
        {TABS.map((tab) => {
          const selected = tabFiltro === tab.id;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => cambiarTab(tab.id)}
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
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Chips horizontales de categorías */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={{ paddingRight: 8 }}
      >
        <Chip label="Todas" selected={!tipo} onPress={() => cambiarTipo(undefined)} />
        {tipos.map((t) => (
          <Chip
            key={t}
            label={favorTypeLabel[t]}
            selected={tipo === t}
            onPress={() => cambiarTipo(t)}
          />
        ))}
      </ScrollView>

      {/* Lista de publicaciones */}
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
              ) : (
                <View style={{ marginTop: spacing.md }}>
                  <AppButton
                    label="Publicar ayuda"
                    icon="add-circle-outline"
                    onPress={() => setModalPublicar(true)}
                  />
                </View>
              )}
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

      {/* Modal limpio para elegir qué publicar (sin ruido permanente en pantalla) */}
      <Modal
        visible={modalPublicar}
        transparent
        animationType="fade"
        onRequestClose={() => setModalPublicar(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalPublicar(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>¿Qué deseas publicar?</Text>
            <Text style={[styles.modalSub, { color: p.muted }]}>
              Elige si necesitas una colaboración o quieres compartir con tus vecinos.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => irACrear('pedir')}
              style={({ pressed }) => [styles.modalOption, pressed && { opacity: 0.85, backgroundColor: colors.naranjaSuave }]}
            >
              <View style={[styles.modalOptionAccent, { backgroundColor: colors.naranja }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOptionTitle}>Pedir ayuda</Text>
                <Text style={styles.modalOptionDesc}>
                  Solicita una herramienta prestada, una mano por un rato o apoyo vecinal.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.gris} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => irACrear('ofrecer')}
              style={({ pressed }) => [styles.modalOption, pressed && { opacity: 0.85, backgroundColor: colors.verdeExitoSuave }]}
            >
              <View style={[styles.modalOptionAccent, { backgroundColor: colors.verdeExito }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOptionTitle}>Ofrecer ayuda</Text>
                <Text style={styles.modalOptionDesc}>
                  Comparte una herramienta que tengas, brinda tu tiempo o conocimientos.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.gris} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setModalPublicar(false)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  titulo: {
    fontSize: 26,
    fontFamily: fonts.bold,
    lineHeight: 32,
  },
  sub: {
    fontSize: 14,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  misPubsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.azulSuave,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  misPubsText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.azul,
  },

  // Botón principal de publicación compacto y elegante
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.azul,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: spacing.xs,
    ...shadow,
  },
  publishBtnText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.blanco,
    letterSpacing: 0.2,
  },

  // Segmented control moderno y limpio
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.azulSuave,
    borderRadius: radius.md,
    padding: 3,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentBtnSelected: {
    backgroundColor: colors.blanco,
    shadowColor: '#132E66',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 13,
  },

  // Scroll de chips de categorías
  chipsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: spacing.xs,
  },

  // Paginación
  paginacion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  paginaBtn: { flex: 1 },
  paginaNum: { fontSize: 14, fontFamily: fonts.medium },

  // Modal para publicar
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 46, 102, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.blanco,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow,
  },
  modalTitulo: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.azul,
    marginBottom: 4,
  },
  modalSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    backgroundColor: colors.fondo,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.grisBorde,
  },
  modalOptionAccent: {
    width: 4,
    height: 38,
    borderRadius: 2,
  },
  modalOptionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.azul,
    marginBottom: 2,
  },
  modalOptionDesc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.gris,
    lineHeight: 18,
  },
  modalCloseBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: spacing.xs,
  },
  modalCloseText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.gris,
  },
});
