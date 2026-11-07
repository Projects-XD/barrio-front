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
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '@/hooks/usePalette';
import { useOfflineSync } from '@/offline/sync';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { useAppStore } from '@/store/app-store';
import { colors, fonts } from '@/theme';

// Los errores de API ya se muestran en pantalla; en desarrollo no deben tapar la demo con avisos rojos.
LogBox.ignoreLogs(['[API_CLIENT]']);

// La metadata de Auth (session.user.user_metadata.zone_id) es solo la zona que el vecino eligió
// al registrarse y nunca se actualiza después (ej. tras la migración 0024 que unificó todo bajo
// Castilla). public.users.zone_id es la fuente real: la misma que usa el backend para autorizar
// cada petición, así que siempre se relee desde ahí al iniciar o restaurar sesión.
async function sessionToStore(session: Session) {
  const prevZoneId = useAppStore.getState().zoneId;
  let zoneId = session.user.user_metadata?.zone_id || prevZoneId || '';
  let userFullName = session.user.user_metadata?.full_name as string | undefined;

  try {
    const { data: dbUser } = await supabase
      .from('users')
      .select('zone_id, full_name')
      .eq('id', session.user.id)
      .maybeSingle();
    if (dbUser?.zone_id) zoneId = dbUser.zone_id;
    if (dbUser?.full_name) userFullName = dbUser.full_name;
  } catch {
    // Sin red: se mantiene la última zona conocida (metadata o store previo) en vez de bloquear la sesión.
  }

  useAppStore.getState().setSession({
    token: session.access_token,
    userId: session.user.id,
    zoneId,
    userFullName,
    userEmail: session.user.email,
  });

  // Si la zona cambió respecto a lo que ya había en el store (ej. el interceptor de api/client.ts
  // u otra petición concurrente alcanzó a guardar la zona vieja antes de que termináramos de leer
  // la real), se descarta toda la caché para que nadie quede viendo datos de la zona equivocada.
  if (zoneId !== prevZoneId) {
    queryClient.clear();
  }
}

export default function RootLayout() {
  const p = usePalette();
  useOfflineSync();

  const [fontsLoaded] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    ...Ionicons.font, // Asegura que la fuente vectorial de Ionicons esté cargada antes de renderizar
  });

  useEffect(() => {
    const { setHydrated, clearSession } = useAppStore.getState();

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user && session.access_token) return sessionToStore(session);
      })
      .finally(setHydrated);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && session.access_token) {
        void sessionToStore(session);
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
            headerBackVisible: true,
            contentStyle: { backgroundColor: p.background },
            headerStyle: { backgroundColor: p.background },
            headerShadowVisible: false,
            headerTitleStyle: {
              fontFamily: fonts.semiBold,
              fontSize: 18,
              color: p.text,
            },
            headerTintColor: p.primary,
          }}
        >
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: true, title: 'Mi cuenta', headerBackTitle: 'Atrás' }} />
          <Stack.Screen name="oficio/[id]" options={{ headerShown: true, title: 'Perfil profesional' }} />
          <Stack.Screen name="favores/nuevo" options={{ presentation: 'card', headerShown: true, title: 'Publicar favor', headerBackTitle: 'Atrás' }} />
          <Stack.Screen name="favores/[id]" options={{ headerShown: true, title: 'Detalle del favor' }} />
          <Stack.Screen name="chat/[id]" options={{ headerShown: true, title: 'Chat' }} />
          <Stack.Screen name="emergencia" options={{ headerShown: true, title: 'Apoyo en emergencia' }} />
          <Stack.Screen name="reportar" options={{ headerShown: true, title: 'Reportar vecino en riesgo' }} />
          <Stack.Screen name="ubicacion" options={{ headerShown: true, title: 'Mi ubicación' }} />
          <Stack.Screen name="avisos" options={{ headerShown: true, title: 'Avisos', headerBackTitle: 'Atras' }} />
          <Stack.Screen name="chats" options={{ headerShown: true, title: 'Mis chats', headerBackTitle: 'Atras' }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
