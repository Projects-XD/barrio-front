import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
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
  const { data, isLoading } = useProfiles(filtro);

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <Text style={[styles.titulo, { color: p.text }]}>Oficios del Barrio</Text>
        <Text style={[styles.subtitulo, { color: p.muted }]}>
          Profesionales recomendados y validados por vecinos de tu zona.
        </Text>
      </View>

      <View style={styles.bannerInfo}>
        <Text style={styles.bannerTexto}>
          ℹ️ Un oficio queda <Text style={styles.bold}>Validado</Text> al recibir visto bueno de al menos 2 vecinos de la zona.
        </Text>
      </View>

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
          renderItem={({ item }) => (
            <ProfessionalCard
              profile={item}
              onPress={() => router.push(`/oficio/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title="Sin oficios en esta categoría"
              message="Aún no hay perfiles registrados en esta categoría en tu zona."
            />
          }
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  titulo: {
    fontSize: 28,
    fontFamily: fonts.bold,
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 15,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  bannerInfo: {
    backgroundColor: '#E0ECFB',
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#BDD7F5',
  },
  bannerTexto: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.azul,
    lineHeight: 18,
  },
  bold: {
    fontFamily: fonts.bold,
  },
  chipsContainer: {
    marginBottom: spacing.sm,
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
});
