import { Tabs } from 'expo-router';
import { usePalette } from '@/hooks/usePalette';
import { colors } from '@/theme';

export default function TabsLayout() {
  const p = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.primary,
        tabBarInactiveTintColor: colors.gris,
        tabBarStyle: { backgroundColor: colors.blanco },
      }}
    >
      <Tabs.Screen name="inicio" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="oficios" options={{ title: 'Oficios' }} />
      <Tabs.Screen name="favores" options={{ title: 'Favores' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
