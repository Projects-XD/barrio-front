import { useEffect } from 'react';
import { ActivityIndicator, LogBox, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
  useFonts,
} from '@expo-google-fonts/instrument-sans';
import { usePalette } from '@/hooks/usePalette';
import { useOfflineSync } from '@/offline/sync';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { useAppStore } from '@/store/app-store';
import { colors, fonts } from '@/theme';

// Los errores de API ya se muestran en pantalla; en desarrollo no deben tapar la demo con avisos rojos.
LogBox.ignoreLogs(['[API_CLIENT]']);

function sessionToStore(session: Session) {
  useAppStore.getState().setSession({
    token: session.access_token,
    userId: session.user.id,
    zoneId: session.user.user_metadata?.zone_id || useAppStore.getState().zoneId || '',
    userFullName: session.user.user_metadata?.full_name,
    userEmail: session.user.email,
  });
}

export default function RootLayout() {
  const p = usePalette();
  useOfflineSync();

  const [fontsLoaded] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });

  useEffect(() => {
    const { setHydrated, clearSession } = useAppStore.getState();

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user && session.access_token) sessionToStore(session);
      })
      .finally(setHydrated);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && session.access_token) {
        sessionToStore(session);
      } else if (!session) {
        clearSession();
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
          <Stack.Screen name="favores/[id]" options={{ headerShown: true, title: 'Detalle del favor' }} />
          <Stack.Screen name="emergencia" options={{ headerShown: true, title: 'Apoyo en emergencia' }} />
          <Stack.Screen name="reportar" options={{ headerShown: true, title: 'Reportar vecino en riesgo' }} />
          <Stack.Screen name="ubicacion" options={{ headerShown: true, title: 'Mi ubicación' }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
