import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { colors } from '@/theme';

interface ChatFabProps {
  bottomOffset?: number;
}

export function ChatFab({ bottomOffset = 88 }: ChatFabProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir mis chats"
      onPress={() => router.push('/chats')}
      style={({ pressed }) => [styles.fab, { bottom: bottomOffset, opacity: pressed ? 0.85 : 1 }]}
    >
      <Ionicons name="chatbubble-ellipses" size={24} color={colors.blanco} />
    </Pressable>
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
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 10,
  },
});
