import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { usePalette } from '@/hooks/usePalette';
import { useMarkNotificationRead, useNotifications } from '@/hooks/useData';
import type { BackendNotification } from '@/api/endpoints';
import type { IconName } from '@/i18n/icons';
import { colors, fonts, spacing } from '@/theme';
import { timeAgo } from '@/utils/time';

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

const typeIcon: Record<BackendNotification['type'], IconName> = {
  interes_en_favor: 'hand-left-outline',
  nuevo_mensaje: 'chatbubble-ellipses-outline',
  visto_bueno_recibido: 'ribbon-outline',
  reporte_actualizado: 'document-text-outline',
  emergencia_activada: 'alert-circle-outline',
  sistema: 'notifications-outline',
};

function describe(n: BackendNotification): { title: string; detail: string | null } {
  const favorTitle = str(n.payload.favor_title);
  switch (n.type) {
    case 'interes_en_favor':
      return {
        title: `${str(n.payload.responder_name) ?? 'Un vecino'} quiere ayudarte`,
        detail: favorTitle ? `En tu favor «${favorTitle}»` : null,
      };
    case 'nuevo_mensaje':
      return {
        title: `Nuevo mensaje de ${str(n.payload.sender_name) ?? 'un vecino'}`,
        detail: favorTitle ? `Sobre «${favorTitle}»` : null,
      };
    case 'visto_bueno_recibido':
      return { title: 'Recibiste un visto bueno', detail: null };
    case 'reporte_actualizado':
      return { title: 'Tu reporte tuvo novedades', detail: null };
    case 'emergencia_activada':
      return { title: 'Se activó una emergencia en tu zona', detail: null };
    default:
      return { title: 'Aviso de Barrio', detail: null };
  }
}

export default function Avisos() {
  const p = usePalette();
  const { data, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();

  // Al volver a la pestaña se actualiza la lista; no hay tiempo real.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const abrir = (n: BackendNotification) => {
    if (!n.read_at) markRead.mutate(n.id);
    const favorId = str(n.payload.favor_id);
    if (favorId) router.push({ pathname: '/favores/[id]', params: { id: favorId } });
  };

  return (
    <Screen>
      <Text style={[styles.titulo, { color: p.text }]}>Avisos</Text>

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
          message="Cuando un vecino responda a tu favor, te avisamos aquí."
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
  titulo: { fontFamily: fonts.bold, fontSize: 28, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  nombre: { fontSize: 16 },
  detalle: { fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  tiempo: { fontFamily: fonts.regular, fontSize: 13, marginTop: 4 },
  punto: { width: 10, height: 10, borderRadius: 5 },
});
