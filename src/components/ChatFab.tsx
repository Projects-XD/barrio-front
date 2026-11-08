import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '@/theme';

interface ChatFabProps {
  bottomOffset?: number;
}

export function ChatFab({ bottomOffset = 88 }: ChatFabProps) {
  const [abierto, setAbierto] = useState(false);

  const irAAgregarAyuda = () => {
    setAbierto(false);
    router.navigate({ pathname: '/(tabs)/favores', params: { publicar: '1' } });
  };

  const irAChats = () => {
    setAbierto(false);
    router.push('/chats');
  };

  return (
    <>
      {/* Botón flotante principal */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={abierto ? 'Cerrar acciones' : 'Abrir acciones de chat y ayudas'}
        onPress={() => setAbierto((v) => !v)}
        style={({ pressed }) => [
          styles.fab,
          { bottom: bottomOffset, opacity: pressed ? 0.88 : 1 },
          abierto && styles.fabAbierto,
        ]}
      >
        <Ionicons
          name={abierto ? 'close' : 'chatbubbles'}
          size={24}
          color={colors.blanco}
        />
      </Pressable>

      {/* Menú expandido cuando está abierto */}
      <Modal
        visible={abierto}
        transparent
        animationType="fade"
        onRequestClose={() => setAbierto(false)}
      >
        <View style={styles.modalOverlay}>
          {/* Fondo para cerrar al tocar afuera */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAbierto(false)} />

          {/* Opciones emergentes ancladas sobre la posición del botón */}
          <View style={[styles.menuContainer, { bottom: bottomOffset + 68 }]}>
            {/* Opción: Agregar ayuda */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Agregar ayuda"
              onPress={irAAgregarAyuda}
              style={({ pressed }) => [
                styles.actionItem,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={styles.labelPill}>
                <Text style={styles.actionLabel}>Agregar ayuda</Text>
              </View>
              <View style={[styles.actionCircle, styles.actionCircleAyuda]}>
                <Ionicons name="add" size={24} color={colors.blanco} />
              </View>
            </Pressable>

            {/* Opción: Mis Chats */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ir a mis chats"
              onPress={irAChats}
              style={({ pressed }) => [
                styles.actionItem,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={styles.labelPill}>
                <Text style={styles.actionLabel}>Mis chats</Text>
              </View>
              <View style={[styles.actionCircle, styles.actionCircleChat]}>
                <Ionicons name="chatbubble-ellipses" size={22} color={colors.blanco} />
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.azul,
    shadowColor: '#132E66',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 10,
  },
  fabAbierto: {
    backgroundColor: colors.gris,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 46, 102, 0.35)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
    gap: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  labelPill: {
    backgroundColor: colors.blanco,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  actionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.azul,
  },
  actionCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  actionCircleAlerta: {
    backgroundColor: colors.rojo,
  },
  actionCircleAyuda: {
    backgroundColor: colors.naranja,
  },
  actionCircleChat: {
    backgroundColor: colors.azulMedio,
  },
});
