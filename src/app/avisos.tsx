import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useMarkNotificationRead, useNotifications } from '@/hooks/useData';
import type { BackendNotification } from '@/api/endpoints';
import { colors, fonts, spacing } from '@/theme';
import { describeNotification as describe, notificationIcon as typeIcon, notificationRoute } from '@/utils/notificaciones';
import { timeAgo } from '@/utils/time';

export default function Avisos() {
  const p = usePalette();
  const { data, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();

  const abrir = (n: BackendNotification) => {
    if (!n.read_at) markRead.mutate(n.id);
    const ruta = notificationRoute(n);
    if (ruta) router.push(ruta as never);
  };

  return (
    <Screen>
      {isLoading ? (
        <ActivityIndicator size="large" color={p.primary} style={{ marginTop: spacing.xl }} />
      ) : isError ? (
        <>
          <EmptyState
            icon="cloud-offline-outline"
            title="No pudimos cargar tus avisos"
            message="Revisa tu conexión e inténtalo de nuevo."
          />
          <AppButton label="Reintentar" variant="secondary" onPress={() => refetch()} />
        </>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="Aún no tienes avisos"
          message="Aquí te avisamos cuando alguien publique una ayuda o un oficio, o responda a tu favor."
        />
      ) : (
        data.map((n) => {
          const { title, detail } = describe(n);
          const unread = !n.read_at;
          return (
            <Card key={n.id} onPress={() => abrir(n)} backgroundColor={unread ? colors.naranjaClaro : colors.blanco}>
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: p.highlight }]}>
                  <Ionicons name={typeIcon[n.type]} size={22} color={p.text} />
                </View>
                <View style={styles.body}>
                  <Text style={[styles.nombre, { color: p.text, fontFamily: unread ? fonts.bold : fonts.semiBold }]}>
                    {title}
                  </Text>
                  {detail ? <Text style={[styles.detalle, { color: p.muted }]}>{detail}</Text> : null}
                  <Text style={[styles.tiempo, { color: p.muted }]}>{timeAgo(n.created_at)}</Text>
                </View>
                {unread ? <View style={[styles.punto, { backgroundColor: colors.naranja }]} /> : null}
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  nombre: { fontSize: 16 },
  detalle: { fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  tiempo: { fontFamily: fonts.regular, fontSize: 13, marginTop: 4 },
  punto: { width: 10, height: 10, borderRadius: 5 },
});
