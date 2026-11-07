import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius } from '@/theme';

interface EmergencyFabProps {
  bottomOffset?: number;
}

export function EmergencyFab({ bottomOffset = 88 }: EmergencyFabProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Emergencia: ver apoyos disponibles"
      onPress={() => router.push('/emergencia')}
      style={({ pressed }) => [
        styles.fab,
        { bottom: bottomOffset, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Ionicons name="alert-circle" size={22} color={colors.blanco} />
      <Text style={styles.label}>Emergencia</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.rojo,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    minHeight: 48,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 10,
  },
  label: { color: colors.blanco, fontFamily: fonts.bold, fontSize: 15 },
});
