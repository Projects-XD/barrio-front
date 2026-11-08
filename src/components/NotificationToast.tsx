import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { BackendNotification } from '@/api/endpoints';
import { colors, fonts, radius, shadow } from '@/theme';
import { describeNotification, notificationIcon, notificationRoute } from '@/utils/notificaciones';

type Props = {
  notification: BackendNotification | null;
  onClose: () => void;
  // Distancia desde el borde superior (debajo de la barra de estado).
  top: number;
  // Espacio que se deja a la derecha para no tapar botones fijos.
  rightInset?: number;
};

const VISIBLE_MS = 5000;

// Aviso emergente: baja desde arriba, se cierra solo a los 5 s y al tocarlo abre su destino.
export function NotificationToast({ notification, onClose, top, rightInset = 80 }: Props) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!notification) return;
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reducir) => {
        if (cancelled) return;
        if (reducir) progress.setValue(1);
        else {
          progress.setValue(0);
          Animated.timing(progress, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: Platform.OS !== 'web',
          }).start();
        }
      })
      .catch(() => progress.setValue(1));

    const timer = setTimeout(onClose, VISIBLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [notification, onClose, progress]);

  if (!notification) return null;

  const { title, detail } = describeNotification(notification);
  const ruta = notificationRoute(notification);

  const abrir = () => {
    onClose();
    if (ruta) router.push(ruta as never);
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top,
          right: rightInset,
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        },
      ]}
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={detail ? `${title}. ${detail}` : title}
        onPress={abrir}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      >
        <View style={styles.icon}>
          <Ionicons name={notificationIcon[notification.type]} size={20} color={colors.azul} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {detail ? (
            <Text style={styles.detail} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar aviso" onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={18} color={colors.gris} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, zIndex: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.blanco,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.grisBorde,
    ...shadow,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.naranjaSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.azul },
  detail: { fontFamily: fonts.regular, fontSize: 13, color: colors.gris, marginTop: 1 },
});
