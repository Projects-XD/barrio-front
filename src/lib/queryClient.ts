import { QueryClient } from '@tanstack/react-query';

// Un solo reintento: si el backend no responde, el error aparece rápido en pantalla.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000 },
    mutations: { retry: 0 },
  },
});
