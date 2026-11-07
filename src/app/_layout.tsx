import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { usePalette } from '@/hooks/usePalette';

const queryClient = new QueryClient();

export default function RootLayout() {
  const p = usePalette();
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: p.background },
          }}
        >
          <Stack.Screen name="oficio/[id]" options={{ headerShown: true, title: 'Perfil profesional' }} />
          <Stack.Screen name="favores/nuevo" options={{ presentation: 'modal', headerShown: true, title: 'Publicar favor' }} />
          <Stack.Screen name="emergencia" options={{ headerShown: true, title: 'Apoyo en emergencia' }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
