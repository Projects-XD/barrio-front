import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { EmergencyFab } from '@/components/EmergencyFab';
import { useEmergencyState, useUnreadNotificationCount } from '@/hooks/useData';
import { usePalette } from '@/hooks/usePalette';
import type { IconName } from '@/i18n/icons';
import { useAppStore } from '@/store/app-store';
import { colors, fonts, radius } from '@/theme';

function TabIcon({ focused, on, off }: { focused: boolean; on: IconName; off: IconName }) {
  const p = usePalette();
  return (
    <View style={[styles.iconPill, focused && { backgroundColor: p.highlight }]}>
      <Ionicons name={focused ? on : off} size={23} color={focused ? p.text : colors.gris} />
    </View>
  );
}

export default function TabsLayout() {
  const p = usePalette();
  const { data: emergency } = useEmergencyState();
  const { data: unread } = useUnreadNotificationCount();

  useEffect(() => {
    if (emergency) useAppStore.getState().setServerEmergency(emergency.status === 'activa');
  }, [emergency]);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: p.text,
          tabBarInactiveTintColor: colors.gris,
          tabBarStyle: styles.bar,
          tabBarLabelStyle: styles.label,
        }}
      >
        <Tabs.Screen
          name="inicio"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ focused }) => <TabIcon focused={focused} on="home" off="home-outline" />,
          }}
        />
        <Tabs.Screen
          name="oficios"
          options={{
            title: 'Oficios',
            tabBarIcon: ({ focused }) => <TabIcon focused={focused} on="construct" off="construct-outline" />,
          }}
        />
        <Tabs.Screen
          name="favores"
          options={{
            title: 'Favores',
            tabBarIcon: ({ focused }) => <TabIcon focused={focused} on="heart" off="heart-outline" />,
          }}
        />
        <Tabs.Screen
          name="avisos"
          options={{
            title: 'Avisos',
            tabBarBadge: unread && unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
            tabBarBadgeStyle: styles.badge,
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} on="notifications" off="notifications-outline" />
            ),
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ focused }) => <TabIcon focused={focused} on="person" off="person-outline" />,
          }}
        />
      </Tabs>
      <EmergencyFab />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.blanco,
    borderTopWidth: 0,
    height: 76,
    paddingTop: 8,
    paddingBottom: 10,
    shadowColor: '#132E66',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  label: { fontFamily: fonts.semiBold, fontSize: 13, marginTop: 2 },
  badge: { backgroundColor: colors.naranja, color: colors.azul, fontFamily: fonts.bold, fontSize: 11 },
  iconPill: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: radius.pill },
});
