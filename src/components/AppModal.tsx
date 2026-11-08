import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  animationType?: 'fade' | 'slide';
  overlayStyle?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
};

const defaultOverlayWeb = Platform.OS === 'web' ? ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100vw',
  height: '100vh',
  zIndex: 9999,
} as unknown as ViewStyle) : undefined;

// Modal con fondo que cierra al tocar fuera. El fondo no lleva rol de botón: así no
// queda un <button> dentro de otro cuando la tarjeta contiene botones (en la web).
export function AppModal({ visible, onClose, children, animationType = 'fade', overlayStyle, cardStyle }: Props) {
  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onClose}>
      <View style={[styles.baseOverlay, defaultOverlayWeb, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={cardStyle}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  baseOverlay: {
    flex: 1,
  },
});

