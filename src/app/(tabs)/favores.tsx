import { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { FavorCard } from '@/components/FavorCard';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useFavors } from '@/hooks/useData';
import { favorTypeLabel } from '@/i18n/labels';
import type { FavorType } from '@/types';
import { fonts, spacing } from '@/theme';

const tipos = Object.keys(favorTypeLabel) as FavorType[];

export default function Favores() {
  const p = usePalette();
  const [tipo, setTipo] = useState<FavorType | undefined>(undefined);
  const { data, isLoading, isError, error, refetch, isRefetching } = useFavors(tipo);

  return (
    <Screen scroll={false}>
      <Text style={[styles.titulo, { color: p.text }]}>Favores</Text>
      <Text style={[styles.sub, { color: p.muted }]}>Ayuda entre vecinos, sin dinero de por medio.</Text>

      <AppButton label="Publicar un favor" icon="add-circle-outline" onPress={() => router.push('/favores/nuevo')} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ paddingRight: 8 }}>
        <Chip label="Todos" selected={!tipo} onPress={() => setTipo(undefined)} />
        {tipos.map((t) => (
          <Chip key={t} label={favorTypeLabel[t]} selected={tipo === t} onPress={() => setTipo(t)} />
        ))}
      </ScrollView>

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
                icon={isError ? 'cloud-offline-outline' : 'heart-outline'}
                title={isError ? 'No pudimos cargar los favores' : tipo ? 'Nada en esta categoría' : 'Aún no hay favores en tu zona'}
                message={
                  isError
                    ? (error as Error)?.message || 'Revisa tu conexión e inténtalo de nuevo.'
                    : 'Sé el primero en pedir una mano o en ofrecer algo que puedas compartir.'
                }
              />
              {isError ? <AppButton label="Reintentar" variant="secondary" icon="refresh" onPress={() => refetch()} /> : null}
            </View>
          }
          contentContainerStyle={{ paddingBottom: spacing.lg, paddingTop: spacing.xs }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: 28, fontFamily: fonts.bold, marginTop: spacing.xs },
  sub: { fontSize: 16, fontFamily: fonts.regular, marginTop: 4, marginBottom: spacing.md },
  chips: { flexGrow: 0, marginBottom: spacing.sm },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: spacing.xl },
});
