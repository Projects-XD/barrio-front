import { Ionicons } from '@expo/vector-icons';
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
          borderTopColor: colors.bordeSuave,
          height: 68,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.semiBold, fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="inicio"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={focused ? p.primary : colors.gris}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="oficios"
        options={{
          title: 'Oficios',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'construct' : 'construct-outline'}
              size={24}
              color={focused ? p.primary : colors.gris}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="favores"
        options={{
          title: 'Favores',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'gift' : 'gift-outline'}
              size={24}
              color={focused ? p.primary : colors.gris}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={focused ? p.primary : colors.gris}
            />
          ),
        }}
      />
    </Tabs>
  );
}
