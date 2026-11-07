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
  const { data, isLoading, isError, error, refetch, isRefetching } = useProfiles(
    filtro,
    busqueda
  );

  const resetFilters = () => {
    setFiltro(undefined);
    setBusqueda('');
  };

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <Text style={[styles.titulo, { color: p.text }]}>Oficios del Barrio</Text>
        <Text style={[styles.subtitulo, { color: p.muted }]}>
          Profesionales recomendados y validados por vecinos de tu zona.
        </Text>
      </View>

      {/* Barra de búsqueda en tiempo real */}
      <View style={[styles.searchBox, { borderColor: p.border }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar oficio o vecino (ej. gasfitería, Tomás)..."
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
            <Text style={styles.clearIcon}>✖</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.bannerInfo}>
        <Text style={styles.bannerTexto}>
          ℹ️ Un oficio queda <Text style={styles.bold}>Validado</Text> al recibir visto bueno de al menos 2 vecinos de la zona.
        </Text>
      </View>

      {/* Filtro horizontal por categoría de oficio */}
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
            <ProfessionalCard
              profile={item}
              onPress={() => router.push(`/oficio/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrapper}>
              <EmptyState
                title={isError ? 'Error al cargar' : 'Sin resultados'}
                message={
                  isError
                    ? (error as Error)?.message || 'No se pudo conectar con el servidor.'
                    : busqueda || filtro
                      ? 'No encontramos oficios que coincidan con tus filtros actuales.'
                      : 'Aún no hay oficios registrados en tu zona.'
                }
              />
              {busqueda || filtro || isError ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={isError ? () => refetch() : resetFilters}
                  style={[styles.resetBtn, { borderColor: p.primary }]}
                >
                  <Text style={[styles.resetText, { color: p.primary }]}>
                    {isError ? 'Reintentar conexión' : 'Limpiar filtros'}
                  </Text>
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
  titulo: {
    fontSize: 26,
    fontFamily: fonts.bold,
    marginBottom: 4,
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
    height: 48,
    marginVertical: spacing.xs,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  clearBtn: {
    padding: 6,
  },
  clearIcon: {
    fontSize: 12,
    color: colors.gris,
  },
  bannerInfo: {
    backgroundColor: '#E0ECFB',
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: '#BDD7F5',
  },
  bannerTexto: {
    fontSize: 12.5,
    fontFamily: fonts.regular,
    color: colors.azul,
    lineHeight: 17,
  },
  bold: {
    fontFamily: fonts.bold,
  },
  chipsContainer: {
    marginBottom: spacing.xs,
  },
  chipsList: {
    paddingVertical: 4,
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
