import { ApiError } from '@/api/client';
import type { ResourceType } from '@/types';

export const RESOURCE_TYPES: ResourceType[] = ['agua', 'medicinas', 'generador', 'transporte', 'alimentos', 'otro'];

// Cuánto se confía en la caché antes de volver a pedir. El valor por defecto (30 s) está en queryClient.ts.
export const FRESH_LIVE_MS = 15_000; // favores, chat, avisos y emergencia: otro vecino los cambia sin avisar
export const FRESH_PROFILES_MS = 2 * 60_000;
export const FRESH_SLOW_MS = 5 * 60_000; // solo cambian por acciones del propio vecino, o casi nunca
export const KEEP_LONG_MS = 30 * 60_000; // gcTime de lo que conviene conservar al salir de la pantalla
export const CATALOG = { staleTime: KEEP_LONG_MS, gcTime: 60 * 60_000 }; // zonas y oficios, datos sembrados
// ponytail: tope de favores activos por zona en mapa e inicio; paginar el mapa si una zona lo supera.
export const FAVORS_LIST_LIMIT = 100; // máximo que acepta GET /favors (validators.ts)

export function isNetworkError(error: unknown) {
  return error instanceof ApiError && error.status === 0;
}
