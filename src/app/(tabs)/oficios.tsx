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
import { EmptyState } from '@/components/EmptyState';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useProfiles } from '@/hooks/useData';
import { oficioLabel } from '@/i18n/labels';
import type { OficioCategory } from '@/types';
import { colors, fonts, radius, spacing } from '@/theme';

const categorias = Object.keys(oficioLabel) as OficioCategory[];

export default function Oficios() {
  const p = usePalette();
  const [filtro, setFiltro] = useState<OficioCategory | undefined>(undefined);
  const [busqueda, setBusqueda] = useState('');
  const { data, isLoading } = useProfiles(filtro, busqueda);

  const resetFilters = () => {
    setFiltro(undefined);
    setBusqueda('');
  };

  return (
    <Screen scroll={false}>
      {/* Header moderno sin emojis */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={[styles.titulo, { color: p.text }]}>Oficios del Barrio</Text>
          <View style={styles.shieldPill}>
            <Ionicons name="shield-checkmark" size={13} color={colors.azul} style={{ marginRight: 4 }} />
            <Text style={styles.shieldText}>2+ avales</Text>
          </View>
        </View>
        <Text style={[styles.subtitulo, { color: p.muted }]}>
          Técnicos recomendados por vecinos en Castilla
        </Text>
      </View>

      {/* Barra de búsqueda moderna con Ionicons */}
      <View style={[styles.searchBox, { borderColor: p.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.gris} style={styles.searchIcon} />
        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar oficio o técnico..."
          placeholderTextColor={colors.gris}
          style={[styles.searchInput, { color: p.text }]}
        />
        {busqueda.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Limpiar búsqueda"
            onPress={() => setBusqueda('')}
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
              onPress={() => setFiltro(item === 'todos' ? undefined : item)}
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
          data={data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProfessionalCard
              profile={item}
              onPress={() => router.push(`/oficio/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrapper}>
              <EmptyState
                title="Sin resultados"
                message={
                  busqueda || filtro
                    ? 'No encontramos oficios con esos filtros.'
                    : 'Aún no hay oficios registrados en tu zona.'
                }
              />
              {busqueda || filtro ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={resetFilters}
                  style={[styles.resetBtn, { borderColor: p.primary }]}
                >
                  <Text style={[styles.resetText, { color: p.primary }]}>Restablecer búsqueda</Text>
                </Pressable>
              ) : null}
            </View>
          }
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  titulo: {
    fontSize: 26,
    fontFamily: fonts.bold,
  },
  shieldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F1FC',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#C8DEF8',
  },
  shieldText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.azul,
  },
  subtitulo: {
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 20,
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
    paddingTop: spacing.md,
  },
  resetBtn: {
    marginTop: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  resetText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
});
