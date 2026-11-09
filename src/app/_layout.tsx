import { useEffect } from 'react';
import { Image, LogBox, View } from 'react-native';
import { Stack } from 'expo-router';
import { NotificationHost } from '@/components/NotificationHost';
import { cargarUrlBackend } from '@/api/client';
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
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '@/hooks/usePalette';
import { useOfflineSync } from '@/offline/sync';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { useAppStore } from '@/store/app-store';
import { colors, fonts } from '@/theme';

// Los errores de API ya se muestran en pantalla; en desarrollo no deben tapar la demo con avisos rojos.
LogBox.ignoreLogs(['[API_CLIENT]']);

// Publica la sesión con la mejor zona que ya se conoce, sin esperar a la red. Así cualquier ruta
// abierta directamente (recargar /mapa, /oficios...) encuentra token y zona desde el primer render.
function publicarSesion(session: Session): string {
  const zoneId = session.user.user_metadata?.zone_id || useAppStore.getState().zoneId || '';
  useAppStore.getState().setSession({
    token: session.access_token,
    userId: session.user.id,
    zoneId,
    userFullName: session.user.user_metadata?.full_name as string | undefined,
    userEmail: session.user.email,
  });
  return zoneId;
}

// La metadata de Auth (session.user.user_metadata.zone_id) es solo la zona que el vecino eligió
// al registrarse y nunca se actualiza después (ej. tras la migración 0024 que unificó todo bajo
// Castilla). public.users.zone_id es la fuente real: la misma que usa el backend para autorizar
// cada petición, así que se relee desde ahí y corrige lo publicado si no coincide.
async function refinarZona(session: Session, zonaPublicada: string) {
  let zoneId = zonaPublicada;
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
    // Sin red: se mantiene la zona ya publicada en vez de bloquear la sesión.
  }

  useAppStore.getState().setSession({
    token: useAppStore.getState().token ?? session.access_token,
    userId: session.user.id,
    zoneId,
    userFullName,
    userEmail: session.user.email,
  });

  // Si la zona real difiere de la publicada, se descarta la caché para que nadie quede viendo
  // datos de la zona equivocada.
  if (zonaPublicada && zoneId !== zonaPublicada) {
    queryClient.clear();
  }
}

export default function RootLayout() {
  const p = usePalette();
  const hydrated = useAppStore((s) => s.hydrated);
  useOfflineSync();

  const [fontsLoaded] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    Fraunces_700Bold,
    Outfit_600SemiBold,
    ...Ionicons.font, // Asegura que la fuente vectorial de Ionicons esté cargada antes de renderizar
  });

  useEffect(() => {
    const { setHydrated, clearSession } = useAppStore.getState();

    cargarUrlBackend()
      .then(() => supabase.auth.getSession())
      .then(async ({ data: { session } }) => {
        if (session?.user && session.access_token) {
          const zonaPublicada = publicarSesion(session);
          setHydrated();
          await refinarZona(session, zonaPublicada);
        }
      })
      .finally(setHydrated);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && session.access_token) {
        void refinarZona(session, publicarSesion(session));
      } else if (!session) {
        clearSession();
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!fontsLoaded || !hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.fondo }}>
        <Image
          source={require('../../assets/brand/logo-barrio.png')}
          style={{ width: 200, height: 70 }}
          resizeMode="contain"
          accessibilityLabel="Barrio"
        />
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
          <Stack.Screen name="favores/nuevo" options={{ presentation: 'card', headerShown: true, title: 'Publicar ayuda', headerBackTitle: 'Atrás' }} />
          <Stack.Screen name="favores/[id]" options={{ headerShown: true, title: 'Detalle de la ayuda', headerBackTitle: 'Atrás' }} />
          <Stack.Screen name="favores/mis-publicaciones" options={{ headerShown: true, title: 'Mis aportes', headerBackTitle: 'Atrás' }} />
          <Stack.Screen name="chat/[id]" options={{ headerShown: true, title: 'Chat' }} />
          <Stack.Screen name="emergencia" options={{ headerShown: true, title: 'Apoyo en emergencia' }} />
          <Stack.Screen name="reportar" options={{ headerShown: true, title: 'Reportar vecino en riesgo' }} />
          <Stack.Screen name="ubicacion" options={{ headerShown: true, title: 'Mi ubicación' }} />
          <Stack.Screen name="avisos" options={{ headerShown: true, title: 'Avisos', headerBackTitle: 'Atras' }} />
          <Stack.Screen name="chats" options={{ headerShown: true, title: 'Mis chats', headerBackTitle: 'Atras' }} />
        </Stack>
        <NotificationHost />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
