import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BackendNotification } from '@/api/endpoints';
import { useNotificationsRealtime } from '@/hooks/useNotificationsRealtime';
import { NotificationToast } from './NotificationToast';

// Máximo de avisos esperando turno; si llegan más de golpe, se conservan los más recientes.
const MAX_COLA = 4;

// Muestra la ventana flotante de cada aviso nuevo en cualquier pantalla, también las que están fuera
// de las pestañas. Los avisos se muestran uno tras otro. Se monta una sola vez en el layout raíz.
export function NotificationHost() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [cola, setCola] = useState<BackendNotification[]>([]);

  const rutaActual = useRef(pathname);
  useEffect(() => {
    rutaActual.current = pathname;
  });

  const agregar = useCallback((n: BackendNotification) => {
    // Si ya estás dentro de esa conversación, el mensaje se ve en el chat y no hace falta avisar.
    const conversacion = typeof n.payload?.conversation_id === 'string' ? n.payload.conversation_id : null;
    if (n.type === 'nuevo_mensaje' && conversacion && rutaActual.current.endsWith('/chat/' + conversacion)) return;
    setCola((c) => [...c, n].slice(-MAX_COLA));
  }, []);
  const cerrar = useCallback(() => setCola((c) => c.slice(1)), []);
  useNotificationsRealtime(agregar);

  // En las pestañas con botón de emergencia arriba a la derecha, el aviso se deja a la izquierda.
  const hayBotonEmergencia = /\/(inicio|oficios|favores)$/.test(pathname);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <NotificationToast
        notification={cola[0] ?? null}
        onClose={cerrar}
        top={insets.top + 8}
        rightInset={hayBotonEmergencia ? 80 : 16}
      />
    </View>
  );
}
