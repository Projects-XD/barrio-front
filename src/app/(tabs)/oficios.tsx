import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { Screen } from '@/components/Screen';
import { SkeletonOficios } from '@/components/SkeletonOficios';
import { usePalette } from '@/hooks/usePalette';
import { useMySavedLocation, useProfiles } from '@/hooks/useData';
import { oficioLabel } from '@/i18n/labels';
import type { OficioCategory } from '@/types';
import { colors, fonts, radius, shadow, spacing } from '@/theme';
import { distanceMetersBetween } from '@/utils/geo';
import { AppModal } from '@/components/AppModal';
import { PaginationControls } from '@/components/PaginationControls';

const categorias = Object.keys(oficioLabel) as OficioCategory[];
const ITEMS_PER_PAGE = 6;

export default function Oficios() {
  const p = usePalette();
  const [filtro, setFiltro] = useState<OficioCategory | undefined>(undefined);
  const [busqueda, setBusqueda] = useState('');
  const [ordenCercania, setOrdenCercania] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [modalFiltro, setModalFiltro] = useState(false);
  const [filtroTemporal, setFiltroTemporal] = useState<OficioCategory | undefined>(undefined);

  const { data: savedLocation } = useMySavedLocation();
  const { data, isLoading, isError, error, refetch, isRefetching } = useProfiles(
    filtro,
    busqueda
  );

  const listaConDistancia = useMemo(() => {
    const base = (data ?? []).map((prof) => {
      const distanceMeters =
        savedLocation && prof.location
          ? distanceMetersBetween({ lat: savedLocation.lat, lng: savedLocation.lng }, prof.location)
          : null;
      return { prof, distanceMeters };
    });
    if (ordenCercania && savedLocation) {
      return [...base].sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999));
    }
    return base;
  }, [data, savedLocation, ordenCercania]);

  const totalItems = listaConDistancia.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const paginaActual = Math.min(pagina, totalPaginas);

  const inicioIdx = (paginaActual - 1) * ITEMS_PER_PAGE;
  const itemsPaginados = listaConDistancia.slice(inicioIdx, inicioIdx + ITEMS_PER_PAGE);

  const abrirModalFiltro = () => {
    setFiltroTemporal(filtro);
    setModalFiltro(true);
  };

  const aplicarFiltro = () => {
    setFiltro(filtroTemporal);
    setPagina(1);
    setModalFiltro(false);
  };

  const borrarFiltro = () => {
    setFiltro(undefined);
    setFiltroTemporal(undefined);
    setPagina(1);
    setModalFiltro(false);
  };

  const handleCambioBusqueda = (texto: string) => {
    setBusqueda(texto);
    setPagina(1);
  };

  const resetFilters = () => {
    setFiltro(undefined);
    setFiltroTemporal(undefined);
    setBusqueda('');
    setPagina(1);
  };

  return (
    <Screen scroll={false}>
      {/* Cabecera limpia (sin botón de emergencia redundante) */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.titulo, { color: p.text }]}>Oficios del Barrio</Text>
        </View>
        <View style={styles.badgeRow}>
          <View style={styles.shieldPill}>
            <Ionicons name="shield-checkmark" size={13} color={colors.verdeExito} style={{ marginRight: 4 }} />
            <Text style={styles.shieldText}>Validación vecinal</Text>
          </View>
        </View>
      </View>

      {/* Barra de búsqueda + botón de filtrar categoría + botón de ordenar por cercanía */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { borderColor: p.border, flex: 1 }]}>
          <Ionicons name="search-outline" size={18} color={colors.gris} style={styles.searchIcon} />
          <TextInput
            value={busqueda}
            onChangeText={handleCambioBusqueda}
            placeholder="Buscar oficio o técnico..."
            placeholderTextColor={colors.gris}
            style={[styles.searchInput, { color: p.text }]}
          />
          {busqueda.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpiar búsqueda"
              onPress={() => handleCambioBusqueda('')}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={18} color={colors.gris} />
            </Pressable>
          ) : null}
        </View>

        {/* Botón que despliega el modal inferior de filtrado */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filtrar por oficio"
          onPress={abrirModalFiltro}
          style={[
            styles.filterTriggerBtn,
            {
              backgroundColor: filtro !== undefined ? colors.azulSuave : colors.blanco,
              borderColor: filtro !== undefined ? colors.azul : p.border,
            },
          ]}
        >
          <Ionicons
            name="options-outline"
            size={16}
            color={filtro !== undefined ? colors.azul : colors.gris}
          />
          <Text style={[styles.filterTriggerText, { color: filtro !== undefined ? colors.azul : p.text }]}>
            {filtro !== undefined ? oficioLabel[filtro] : 'Filtrar'}
          </Text>
        </Pressable>

        {savedLocation ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ordenar por más cercanos"
            onPress={() => {
              setOrdenCercania((v) => !v);
              setPagina(1);
            }}
            style={[
              styles.nearBtn,
              {
                backgroundColor: ordenCercania ? colors.azul : colors.blanco,
                borderColor: ordenCercania ? colors.azul : p.border,
              },
            ]}
          >
            <Ionicons
              name="navigate-outline"
              size={15}
              color={ordenCercania ? colors.blanco : colors.azul}
            />
            <Text style={[styles.nearBtnText, { color: ordenCercania ? colors.blanco : colors.azul }]}>
              Cercanos
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Indicador de filtro activo con botón para limpiarlo */}
      {filtro !== undefined ? (
        <View style={styles.activeFilterBar}>
          <Text style={styles.activeFilterText}>
            Oficio: <Text style={{ fontFamily: fonts.bold }}>{oficioLabel[filtro]}</Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quitar filtro de oficio"
            onPress={borrarFiltro}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color={colors.azul} />
          </Pressable>
        </View>
      ) : null}

      {/* Lista de oficios con Skeleton pulsante en estado de carga */}
      {isLoading ? (
        <SkeletonOficios count={4} />
      ) : (
        <FlatList
          data={itemsPaginados}
          keyExtractor={(item) => item.prof.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <ProfessionalCard
              profile={item.prof}
              distanceMeters={item.distanceMeters}
              onPress={() => router.push(`/oficio/${item.prof.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrapper}>
              <Text style={[styles.emptyTitle, { color: p.text }]}>
                {isError ? 'Error al cargar' : 'Sin resultados'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: p.muted }]}>
                {isError
                  ? (error as Error)?.message || 'No se pudo conectar con el servidor.'
                  : busqueda || filtro
                    ? 'No encontramos oficios con esos filtros en tu zona.'
                    : 'Aún no hay técnicos registrados en tu zona.'}
              </Text>

              <View style={styles.emptyActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/(tabs)/perfil')}
                  style={styles.registerOficioBtn}
                >
                  <Ionicons name="briefcase-outline" size={16} color={colors.blanco} style={{ marginRight: 6 }} />
                  <Text style={styles.registerOficioText}>Registrar mi oficio aquí</Text>
                </Pressable>

                {busqueda || filtro || isError ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={isError ? () => refetch() : resetFilters}
                    style={[styles.resetBtn, { borderColor: p.primary }]}
                  >
                    <Text style={[styles.resetText, { color: p.primary }]}>
                      {isError ? 'Reintentar' : 'Limpiar filtros'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          }
          ListFooterComponent={
            totalPaginas > 1 ? (
              <PaginationControls
                page={paginaActual}
                totalPages={totalPaginas}
                hasPrev={paginaActual > 1}
                hasNext={paginaActual < totalPaginas}
                onPrev={() => setPagina((p) => Math.max(1, p - 1))}
                onNext={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              />
            ) : undefined
          }
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}

      {/* Modal inferior (Bottom Sheet) para filtrar oficios */}
      <AppModal visible={modalFiltro} onClose={() => setModalFiltro(false)} animationType="slide" overlayStyle={styles.sheetOverlay} cardStyle={styles.sheetContent}>
                    <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Filtrar por oficio</Text>
                <Text style={styles.sheetSub}>Selecciona una especialidad vecinal</Text>
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
              {/* Opción Todos */}
              <Pressable
                accessibilityRole="button"
                onPress={() => setFiltroTemporal(undefined)}
                style={[
                  styles.sheetRow,
                  filtroTemporal === undefined && styles.sheetRowSelected,
                ]}
              >
                <Text
                  style={[
                    styles.sheetRowText,
                    filtroTemporal === undefined && styles.sheetRowTextSelected,
                  ]}
                >
                  Todos los oficios
                </Text>
                {filtroTemporal === undefined ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.azul} />
                ) : (
                  <View style={styles.sheetRadioCircle} />
                )}
              </Pressable>

              {/* Categorías específicas */}
              {categorias.map((cat) => {
                const isSelected = filtroTemporal === cat;
                return (
                  <Pressable
                    key={cat}
                    accessibilityRole="button"
                    onPress={() => setFiltroTemporal(cat)}
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
                      {oficioLabel[cat]}
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
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titulo: {
    fontSize: 24,
    fontFamily: fonts.display,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 4,
  },
  shieldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.verdeExitoSuave,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  shieldText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.verdeExito,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: spacing.xs,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blanco,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 46,
  },
  filterTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  filterTriggerText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  activeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.azulSuave,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  activeFilterText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.azul,
  },
  nearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  nearBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  clearBtn: {
    padding: 4,
  },
  chipsContainer: {
    marginBottom: spacing.xs,
  },
  chipsList: {
    paddingVertical: 2,
  },
  emptyWrapper: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 290,
    marginBottom: spacing.md,
  },
  emptyActions: {
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  registerOficioBtn: {
    backgroundColor: colors.naranja,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    ...shadow,
  },
  registerOficioText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.blanco,
  },
  resetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  resetText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
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
    maxHeight: 320,
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
