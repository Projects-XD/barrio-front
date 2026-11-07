import { Tabs } from 'expo-router';
import { usePalette } from '@/hooks/usePalette';
import { colors, fonts } from '@/theme';

export default function TabsLayout() {
  const p = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.primary,
        tabBarInactiveTintColor: colors.gris,
        tabBarStyle: {
          backgroundColor: colors.blanco,
          borderTopColor: colors.grisBorde,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.semiBold,
          fontSize: 13,
        },
      }}
    >
      <Tabs.Screen name="inicio" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="oficios" options={{ title: 'Oficios' }} />
      <Tabs.Screen name="favores" options={{ title: 'Favores' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
