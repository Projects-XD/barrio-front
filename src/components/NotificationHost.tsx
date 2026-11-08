import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BackendNotification } from '@/api/endpoints';
import { useNotificationsRealtime } from '@/hooks/useNotificationsRealtime';
import { NotificationToast } from './NotificationToast';

// Muestra el aviso emergente de cualquier pantalla, también las que están fuera de las pestañas.
// Se monta una sola vez en el layout raíz.
export function NotificationHost() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [aviso, setAviso] = useState<BackendNotification | null>(null);
  const cerrar = useCallback(() => setAviso(null), []);
  useNotificationsRealtime(setAviso);

  // En las pestañas con botón de emergencia arriba a la derecha, el aviso se deja a la izquierda.
  const hayBotonEmergencia = /\/(inicio|oficios|favores)$/.test(pathname);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <NotificationToast
        notification={aviso}
        onClose={cerrar}
        top={insets.top + 8}
        rightInset={hayBotonEmergencia ? 80 : 16}
      />
    </View>
  );
}
