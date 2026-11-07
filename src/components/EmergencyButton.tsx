import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius } from '@/theme';

export function EmergencyButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ir a Emergencia y Red de Soporte"
      onPress={() => router.push('/emergencia')}
      style={({ pressed }) => [
        styles.badge,
        pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
      ]}
      hitSlop={8}
    >
      <Ionicons name="alert-circle" size={15} color={colors.blanco} />
      <Text style={styles.text}>Emergencia</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.rojo,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    shadowColor: colors.rojo,
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.blanco,
    letterSpacing: 0.2,
  },
});
