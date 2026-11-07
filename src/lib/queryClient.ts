import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

// Un solo reintento: si el backend no responde, el error aparece rápido en pantalla.
// Cada hook de useData.ts ajusta staleTime y gcTime según cuánto cambian sus datos.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, gcTime: 5 * 60_000 },
    mutations: { retry: 0 },
  },
});

// React Native no avisa solo a TanStack Query: sin esto el polling sigue con la app en segundo plano.
// onlineManager queda sin conectar a propósito: pausaría las consultas sin red, y useFavors las
// necesita para mostrar los favores pendientes de SQLite.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
}
