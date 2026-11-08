import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { FavorCard } from '@/components/FavorCard';
import { Screen } from '@/components/Screen';
import { SkeletonFavores } from '@/components/SkeletonFavores';
import { usePalette } from '@/hooks/usePalette';
import { useFavorsPage } from '@/hooks/useData';
import { useAppStore } from '@/store/app-store';
import { favorTypeLabel } from '@/i18n/labels';
import type { FavorIntent, FavorType } from '@/types';
import { colors, fonts, radius, shadow, spacing } from '@/theme';
import { AppModal } from '@/components/AppModal';
import { PaginationControls } from '@/components/PaginationControls';
import { FadeInView } from '@/components/FadeInView';

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
  const [tipoTemporal, setTipoTemporal] = useState<FavorType | undefined>(undefined);
  const [pagina, setPagina] = useState(0);
  const [modalPublicar, setModalPublicar] = useState(false);
  const { publicar } = useLocalSearchParams<{ publicar?: string }>();
  const abiertoDesdeBurbuja = publicar === '1';
  const cerrarModalPublicar = () => {
    setModalPublicar(false);
    if (abiertoDesdeBurbuja) router.setParams({ publicar: undefined });
  };
  const [modalFiltro, setModalFiltro] = useState(false);
  const userId = useAppStore((s) => s.userId);

  const intent: FavorIntent | undefined =
    tabFiltro === 'pedir' ? 'pedir' : tabFiltro === 'ofrecer' ? 'ofrecer' : undefined;

  // mine: false asegura que los aportes del propio usuario no se muestren en la lista comunitaria
  const { data, isLoading, isError, error, refetch, isRefetching, isPlaceholderData } = useFavorsPage({
    type: tipo,
    intent,
    mine: false,
    page: pagina,
  });

  // Filtro adicional en frontend para asegurar que las publicaciones propias solo salgan en "Mis aportes"
  const favores = (data?.items ?? []).filter((f) => !userId || f.authorId !== userId);

  const cambiarTab = (nuevoTab: TabFiltro) => {
    setTabFiltro(nuevoTab);
    setPagina(0);
  };

  const abrirModalFiltro = () => {
    setTipoTemporal(tipo);
    setModalFiltro(true);
  };

  const aplicarFiltro = () => {
    setTipo(tipoTemporal);
    setPagina(0);
    setModalFiltro(false);
  };

  const borrarFiltro = () => {
    setTipo(undefined);
    setTipoTemporal(undefined);
    setPagina(0);
    setModalFiltro(false);
  };

  const irACrear = (modo: 'pedir' | 'ofrecer') => {
    cerrarModalPublicar();
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
      </View>

      {/* Barra de control: Segmento (Todos | Piden | Ofrecen) + Botón modal de Filtro */}
      <View style={styles.controlsRow}>
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

        {/* Botón que abre el modal inferior para filtrar categoría */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir filtro por categoría"
          onPress={abrirModalFiltro}
          style={[
            styles.filterTriggerBtn,
            tipo !== undefined && styles.filterTriggerBtnActive,
          ]}
        >
          <Ionicons
            name="options-outline"
            size={17}
            color={tipo !== undefined ? colors.azul : colors.gris}
          />
          {tipo !== undefined ? (
            <View style={styles.filterActiveDot} />
          ) : null}
        </Pressable>
      </View>

      {/* Indicador de categoría activa (si se aplicó filtro) con botón rápido para limpiarlo */}
      {tipo !== undefined ? (
        <View style={styles.activeFilterBar}>
          <Text style={styles.activeFilterText}>
            Filtro: <Text style={{ fontFamily: fonts.bold }}>{favorTypeLabel[tipo]}</Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quitar filtro de categoría"
            onPress={borrarFiltro}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color={colors.azul} />
          </Pressable>
        </View>
      ) : null}

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
          renderItem={({ item, index }) => (
            <FadeInView index={index}>
              <FavorCard
                favor={item}
                onPress={item.syncStatus === 'enviado' ? () => router.push(`/favores/${item.id}`) : undefined}
              />
            </FadeInView>
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
              <PaginationControls
                page={pagina + 1}
                hasPrev={pagina > 0 && !isPlaceholderData}
                hasNext={Boolean(data?.hasNext) && !isPlaceholderData}
                onPrev={() => setPagina((n) => Math.max(0, n - 1))}
                onNext={() => setPagina((n) => n + 1)}
              />
            ) : undefined
          }
        />
      )}

      {/* Modal para publicar (+), sin ocupar espacio en pantalla */}
      <AppModal visible={modalPublicar || abiertoDesdeBurbuja} onClose={cerrarModalPublicar} animationType="fade" overlayStyle={styles.modalOverlay} cardStyle={styles.modalCard}>
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
              onPress={cerrarModalPublicar}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </Pressable>
      </AppModal>

      {/* Modal inferior (Bottom Sheet) para filtrar categorías */}
      <AppModal visible={modalFiltro} onClose={() => setModalFiltro(false)} animationType="slide" overlayStyle={styles.sheetOverlay} cardStyle={styles.sheetContent}>
                    <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Filtrar por categoría</Text>
                <Text style={styles.sheetSub}>Selecciona una opción de ayuda</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setModalFiltro(false)}
                style={styles.sheetCloseIcon}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.gris} />
              </Pressable>
            </View>

            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              {/* Opción Todas */}
              <Pressable
                accessibilityRole="button"
                onPress={() => setTipoTemporal(undefined)}
                style={[
                  styles.sheetRow,
                  tipoTemporal === undefined && styles.sheetRowSelected,
                ]}
              >
                <Text
                  style={[
                    styles.sheetRowText,
                    tipoTemporal === undefined && styles.sheetRowTextSelected,
                  ]}
                >
                  Todas las categorías
                </Text>
                {tipoTemporal === undefined ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.azul} />
                ) : (
                  <View style={styles.sheetRadioCircle} />
                )}
              </Pressable>

              {/* Categorías específicas */}
              {tipos.map((t) => {
                const isSelected = tipoTemporal === t;
                return (
                  <Pressable
                    key={t}
                    accessibilityRole="button"
                    onPress={() => setTipoTemporal(t)}
                    style={[
                      styles.sheetRow,
                      isSelected && styles.sheetRowSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sheetRowText,
                        isSelected && styles.sheetRowTextSelected,
                      ]}
                    >
                      {favorTypeLabel[t]}
                    </Text>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.azul} />
                    ) : (
                      <View style={styles.sheetRadioCircle} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Acciones del modal inferior: Borrar filtro y Aplicar */}
            <View style={styles.sheetActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Borrar filtro"
                onPress={borrarFiltro}
                style={styles.sheetBtnSecondary}
              >
                <Text style={styles.sheetBtnSecondaryText}>Borrar filtro</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Aplicar filtro"
                onPress={aplicarFiltro}
                style={styles.sheetBtnPrimary}
              >
                <Text style={styles.sheetBtnPrimaryText}>Aplicar</Text>
              </Pressable>
            </View>
      </AppModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  titulo: {
    fontSize: 23,
    fontFamily: fonts.section,
    lineHeight: 28,
  },
  sub: {
    fontSize: 13,
    fontFamily: fonts.regular,
    marginTop: 2,
  },

  // Fila de controles: Segmented bar + Botón de filtro
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  segmentContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.azulSuave,
    borderRadius: radius.md,
    padding: 3,
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
  filterTriggerBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.blanco,
    borderWidth: 1.5,
    borderColor: colors.grisBorde,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterTriggerBtnActive: {
    backgroundColor: colors.azulSuave,
    borderColor: colors.azul,
  },
  filterActiveDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.azul,
  },

  // Barra de filtro activo
  activeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.azulSuave,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  activeFilterText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.azul,
  },

  // Modal para publicar (+)
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

  // Modal inferior (Bottom Sheet)
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 46, 102, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: colors.blanco,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
    ...shadow,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.grisBorde,
  },
  sheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 19,
    color: colors.azul,
  },
  sheetSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.gris,
    marginTop: 2,
  },
  sheetCloseIcon: {
    padding: 4,
  },
  sheetScroll: {
    maxHeight: 300,
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    marginBottom: 4,
  },
  sheetRowSelected: {
    backgroundColor: colors.azulSuave,
  },
  sheetRowText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.texto,
  },
  sheetRowTextSelected: {
    fontFamily: fonts.bold,
    color: colors.azul,
  },
  sheetRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.grisBorde,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.grisBorde,
  },
  sheetBtnSecondary: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.md,
    backgroundColor: colors.fondo,
    borderWidth: 1,
    borderColor: colors.grisBorde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnSecondaryText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.gris,
  },
  sheetBtnPrimary: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.md,
    backgroundColor: colors.azul,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnPrimaryText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.blanco,
  },
});
