import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import {
  useFonts,
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import { usePalette } from '@/hooks/usePalette';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/app-store';
import { colors, fonts } from '@/theme';

const queryClient = new QueryClient();

export default function RootLayout() {
  const p = usePalette();
  const setSession = useAppStore((s) => s.setSession);
  const clearSession = useAppStore((s) => s.clearSession);

  const [fontsLoaded] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });

  useEffect(() => {
    // 1. Restaurar sesión persistida en SecureStore
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && session.access_token) {
        setSession({
          token: session.access_token,
          userId: session.user.id,
          zoneId:
            session.user.user_metadata?.zone_id ||
            'a23c2ac0-4434-48bb-a091-89fbedf46dc6',
          userFullName: session.user.user_metadata?.full_name,
          userEmail: session.user.email,
        });
      }
    });

    // 2. Suscribirse a cambios de estado de autenticación de Supabase
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && session.access_token) {
        setSession({
          token: session.access_token,
          userId: session.user.id,
          zoneId:
            session.user.user_metadata?.zone_id ||
            useAppStore.getState().zoneId ||
            'a23c2ac0-4434-48bb-a091-89fbedf46dc6',
          userFullName: session.user.user_metadata?.full_name,
          userEmail: session.user.email,
        });
      } else if (!session) {
        clearSession();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession, clearSession]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.fondo }}>
        <ActivityIndicator size="large" color={colors.azul} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          id={undefined}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: p.background },
            headerTitleStyle: {
              fontFamily: fonts.semiBold,
              fontSize: 18,
              color: p.text,
            },
            headerTintColor: p.primary,
          }}
        >
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="oficio/[id]" options={{ headerShown: true, title: 'Perfil profesional' }} />
          <Stack.Screen name="favores/nuevo" options={{ presentation: 'modal', headerShown: true, title: 'Publicar favor' }} />
          <Stack.Screen name="emergencia" options={{ headerShown: true, title: 'Apoyo en emergencia' }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
