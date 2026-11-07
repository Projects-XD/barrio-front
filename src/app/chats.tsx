import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useConversations } from '@/hooks/useData';
import { usePalette } from '@/hooks/usePalette';
import type { BackendConversation } from '@/api/endpoints';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, radius, spacing } from '@/theme';
import { timeAgo } from '@/utils/time';

function ultimaActividad(c: BackendConversation) {
  return c.last_message_at ?? c.created_at;
}

export default function Chats() {
  const p = usePalette();
  const userId = useAppStore((s) => s.userId);
  const { data = [], isLoading, isError, refetch } = useConversations();

  const ordenadas = [...data].sort(
    (a, b) => new Date(ultimaActividad(b)).getTime() - new Date(ultimaActividad(a)).getTime(),
  );

  if (isLoading) {
    return <ActivityIndicator size="large" color={p.primary} style={{ marginTop: spacing.xl }} />;
  }

  if (isError) {
    return (
      <Screen scroll={false}>
        <EmptyState
          icon="cloud-offline-outline"
          title="No pudimos cargar tus chats"
          message="Revisa tu conexión e inténtalo de nuevo."
        />
        <Pressable onPress={() => refetch()} accessibilityRole="button" style={styles.reintentar}>
          <Text style={[styles.reintentarTexto, { color: colors.azul }]}>Reintentar</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={ordenadas}
        keyExtractor={(c) => c.id}
        contentContainerStyle={ordenadas.length === 0 ? styles.vacio : undefined}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="Aún no tienes chats"
            message="Cuando te interese un favor o alguien responda al tuyo, tu chat aparecerá aquí."
          />
        }
        renderItem={({ item }) => {
          const otro = item.author_id === userId ? item.responder : item.author;
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/chat/${item.id}`)}
              style={({ pressed }) => [
                styles.fila,
                { backgroundColor: p.surface, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <View style={[styles.icono, { backgroundColor: p.highlight }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.azul} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.nombre, { color: p.text }]} numberOfLines={1}>
                  {otro?.full_name ?? 'Vecino'}
                </Text>
                <Text style={[styles.favor, { color: p.muted }]} numberOfLines={1}>
                  {item.favor?.title ?? 'Favor'}
                </Text>
              </View>
              <Text style={[styles.tiempo, { color: p.muted }]}>{timeAgo(ultimaActividad(item))}</Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  icono: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  nombre: { fontFamily: fonts.bold, fontSize: 16 },
  favor: { fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  tiempo: { fontFamily: fonts.medium, fontSize: 12 },
  vacio: { flexGrow: 1, justifyContent: 'center' },
  reintentar: { alignSelf: 'center', padding: spacing.md },
  reintentarTexto: { fontFamily: fonts.bold, fontSize: 15 },
});
