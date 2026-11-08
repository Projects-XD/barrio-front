import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  animationType?: 'fade' | 'slide';
  overlayStyle?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
};

// Modal con fondo que cierra al tocar fuera. El fondo no lleva rol de botón: así no
// queda un <button> dentro de otro cuando la tarjeta contiene botones (en la web).
export function AppModal({ visible, onClose, children, animationType = 'fade', overlayStyle, cardStyle }: Props) {
  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onClose}>
      <View style={overlayStyle}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={cardStyle}>{children}</View>
      </View>
    </Modal>
  );
}
