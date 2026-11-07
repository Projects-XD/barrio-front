import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '@/components/Chip';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useProfiles } from '@/hooks/useData';
import { oficioLabel } from '@/i18n/labels';
import type { OficioCategory } from '@/types';
import { colors, fonts, radius, shadow, spacing } from '@/theme';

const categorias = Object.keys(oficioLabel) as OficioCategory[];
const ITEMS_PER_PAGE = 6;

export default function Oficios() {
  const p = usePalette();
  const [filtro, setFiltro] = useState<OficioCategory | undefined>(undefined);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);

  const { data, isLoading, isError, error, refetch, isRefetching } = useProfiles(
    filtro,
    busqueda
  );

  const listaCompleta = data ?? [];
  const totalItems = listaCompleta.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const paginaActual = Math.min(pagina, totalPaginas);

  const inicioIdx = (paginaActual - 1) * ITEMS_PER_PAGE;
  const itemsPaginados = listaCompleta.slice(inicioIdx, inicioIdx + ITEMS_PER_PAGE);

  const handleCambioFiltro = (nuevoFiltro: OficioCategory | undefined) => {
    setFiltro(nuevoFiltro);
    setPagina(1);
  };

  const handleCambioBusqueda = (texto: string) => {
    setBusqueda(texto);
    setPagina(1);
  };

  const resetFilters = () => {
    setFiltro(undefined);
    setBusqueda('');
    setPagina(1);
  };

  return (
    <Screen scroll={false}>
      {/* Cabecera limpia con salto de línea para Validación Vecinal */}
      <View style={styles.header}>
        <Text style={[styles.titulo, { color: p.text }]}>Oficios del Barrio</Text>
        <View style={styles.badgeRow}>
          <View style={styles.shieldPill}>
            <Ionicons name="shield-checkmark" size={13} color={colors.verdeExito} style={{ marginRight: 4 }} />
            <Text style={styles.shieldText}>Validación vecinal</Text>
          </View>
        </View>
      </View>

      {/* Barra de búsqueda */}
      <View style={[styles.searchBox, { borderColor: p.border }]}>
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

      {/* Filtros horizontales por categoría */}
      <View style={styles.chipsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['todos', ...categorias] as (OficioCategory | 'todos')[]}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Chip
              label={item === 'todos' ? 'Todos' : oficioLabel[item]}
              selected={item === 'todos' ? !filtro : filtro === item}
              onPress={() => handleCambioFiltro(item === 'todos' ? undefined : item)}
            />
          )}
          contentContainerStyle={styles.chipsList}
        />
      </View>

      {/* Lista de oficios */}
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={p.primary} />
        </View>
      ) : (
        <FlatList
          data={itemsPaginados}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <ProfessionalCard
              profile={item}
              onPress={() => router.push(`/oficio/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrapper}>
              {/* Sin círculo ni avatar grande de herramientas, solo texto limpio */}
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

              {/* Botón para registrarse como oficio o limpiar filtros */}
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
              <View style={styles.paginationRow}>
                <Pressable
                  disabled={paginaActual === 1}
                  onPress={() => setPagina((p) => Math.max(1, p - 1))}
                  style={[
                    styles.pageBtn,
                    paginaActual === 1 && styles.pageBtnDisabled,
                  ]}
                >
                  <Ionicons name="chevron-back" size={16} color={paginaActual === 1 ? colors.gris : colors.azul} />
                  <Text style={[styles.pageBtnText, paginaActual === 1 && styles.pageBtnTextDisabled]}>
                    Anterior
                  </Text>
                </Pressable>

                <Text style={styles.pageIndicator}>
                  Página {paginaActual} de {totalPaginas}
                </Text>

                <Pressable
                  disabled={paginaActual === totalPaginas}
                  onPress={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  style={[
                    styles.pageBtn,
                    paginaActual === totalPaginas && styles.pageBtnDisabled,
                  ]}
                >
                  <Text style={[styles.pageBtnText, paginaActual === totalPaginas && styles.pageBtnTextDisabled]}>
                    Siguiente
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={paginaActual === totalPaginas ? colors.gris : colors.azul} />
                </Pressable>
              </View>
            ) : undefined
          }
          contentContainerStyle={{ paddingBottom: 100 }}
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blanco,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 46,
    marginVertical: spacing.xs,
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
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xl,
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
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.xs,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.blanco,
    borderWidth: 1,
    borderColor: colors.grisBorde,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.azul,
  },
  pageBtnTextDisabled: {
    color: colors.gris,
  },
  pageIndicator: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.gris,
  },
});
