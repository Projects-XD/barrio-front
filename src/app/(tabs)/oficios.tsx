import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useProfiles } from '@/hooks/useData';
import { oficioLabel } from '@/i18n/labels';
import type { OficioCategory } from '@/types';
import { spacing } from '@/theme';

const categorias = Object.keys(oficioLabel) as OficioCategory[];

export default function Oficios() {
  const p = usePalette();
  const [filtro, setFiltro] = useState<OficioCategory | undefined>(undefined);
  const { data, isLoading } = useProfiles(filtro);

  return (
    <Screen scroll={false}>
      <View style={styles.chips}>
        <Chip label="Todos" selected={!filtro} onPress={() => setFiltro(undefined)} />
        {categorias.map((c) => (
          <Chip key={c} label={oficioLabel[c]} selected={filtro === c} onPress={() => setFiltro(c)} />
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={p.primary} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProfessionalCard profile={item} onPress={() => router.push(`/oficio/${item.id}`)} />
          )}
          ListEmptyComponent={
            <EmptyState title="Sin oficios todavía" message="No hay perfiles en esta categoría en tu zona." />
          }
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
});
