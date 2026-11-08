import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { colors } from '@/theme';

interface EmergencyFabProps {
  top: number;
}

// Botón circular de emergencia, arriba a la derecha, siempre visible.
export function EmergencyFab({ top }: EmergencyFabProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Emergencia: ver apoyos disponibles"
      onPress={() => router.push('/emergencia')}
      style={({ pressed }) => [styles.fab, { top, opacity: pressed ? 0.85 : 1 }]}
    >
      <Ionicons name="alert-circle" size={26} color={colors.blanco} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.rojo,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 10,
  },
});
