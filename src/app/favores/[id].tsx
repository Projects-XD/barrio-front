import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useExpressInterest, useFavor } from '@/hooks/useData';
import { favorStatusLabel, favorTypeBackground, favorTypeLabel } from '@/i18n/labels';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, spacing } from '@/theme';

export default function FavorDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const userId = useAppStore((s) => s.userId);
  const { data: favor, isLoading, isError, error, refetch } = useFavor(id);
  const interes = useExpressInterest(id);

  const handleInteres = async () => {
    try {
      await interes.mutateAsync(undefined);
      Alert.alert('Listo', 'Le avisamos al vecino que puedes ayudar.');
    } catch (err) {
      Alert.alert('No se pudo registrar tu interés', (err as Error)?.message ?? 'Inténtalo de nuevo.');
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={p.primary} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  if (isError || !favor) {
    return (
      <Screen>
        <EmptyState
          title="No pudimos abrir este favor"
          message={(error as Error)?.message ?? 'Puede que ya no esté disponible.'}
        />
        <AppButton label="Reintentar" variant="secondary" onPress={() => refetch()} />
      </Screen>
    );
  }

  const esMio = favor.authorId === userId;
  const abierto = favor.status === 'abierta' || favor.status === 'en_curso';

  return (
    <Screen>
      <Card backgroundColor={favorTypeBackground[favor.type]}>
        <Text style={[styles.tipo, { color: p.muted }]}>{favorTypeLabel[favor.type]}</Text>
        <Text style={[styles.titulo, { color: colors.azul }]}>{favor.title}</Text>
        {favor.description ? <Text style={styles.descripcion}>{favor.description}</Text> : null}
        <View style={styles.meta}>
          <Text style={styles.metaText}>Publicado por {esMio ? 'ti' : favor.author.fullName}</Text>
          <Text style={styles.metaText}>Estado: {favorStatusLabel[favor.status]}</Text>
          <Text style={styles.metaText}>
            {favor.interestedCount === 1 ? '1 vecino interesado' : `${favor.interestedCount} vecinos interesados`}
          </Text>
        </View>
      </Card>

      {esMio ? (
        <Text style={[styles.nota, { color: p.muted }]}>
          Esta es tu publicación. Los vecinos interesados aparecerán aquí.
        </Text>
      ) : favor.hasInterestedByMe ? (
        <Text style={[styles.nota, { color: p.primary }]}>Ya le avisaste a este vecino que puedes ayudar.</Text>
      ) : abierto ? (
        <AppButton
          label={interes.isPending ? 'Enviando...' : 'Me interesa, puedo ayudar'}
          variant="accent"
          onPress={handleInteres}
          disabled={interes.isPending}
        />
      ) : (
        <Text style={[styles.nota, { color: p.muted }]}>Este favor ya está cerrado.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tipo: { fontFamily: fonts.semiBold, fontSize: 14 },
  titulo: { fontFamily: fonts.bold, fontSize: 22, marginTop: 4 },
  descripcion: { fontFamily: fonts.regular, fontSize: 16, color: colors.texto, marginTop: spacing.sm, lineHeight: 22 },
  meta: { marginTop: spacing.md, gap: 4 },
  metaText: { fontFamily: fonts.medium, fontSize: 14, color: colors.texto },
  nota: { fontFamily: fonts.medium, fontSize: 15, textAlign: 'center', marginTop: spacing.md },
});
