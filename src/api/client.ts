import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/app-store';
import { logger } from '@/utils/logger';

const RAW_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace(
  /\/+$/,
  ''
);

// Sin timeout, un servidor inaccesible deja la petición colgada y nunca se usa la cola offline.
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  code?: number;
  error?: string;
}

/**
 * Normaliza la URL para soportar rutas relativas como '/profiles', '/api/profiles'
 * o '/api/v1/profiles' sin duplicar prefijos con BASE_URL.
 */
function buildFullUrl(path: string): string {
  let cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Si BASE_URL ya contiene '/api/v1' y el path viene con '/api/v1', limpiarlo
  if (RAW_BASE_URL.endsWith('/api/v1') && cleanPath.startsWith('/api/v1')) {
    cleanPath = cleanPath.substring(7);
  } else if (RAW_BASE_URL.endsWith('/api') && cleanPath.startsWith('/api')) {
    cleanPath = cleanPath.substring(4);
  }

  return `${RAW_BASE_URL}${cleanPath}`;
}

/**
 * Cliente HTTP principal con interceptor de autenticación Bearer token y observabilidad.
 * Lee el token directamente de Zustand store o lo refresca desde Supabase.
 */
export async function request<T>(
  path: string,
  options: RequestInit = {},
  explicitToken?: string
): Promise<T> {
  const url = buildFullUrl(path);
  const method = options.method || 'GET';

  // 1. Interceptor de sesión: obtener token de Zustand o de la sesión activa de Supabase
  let token = explicitToken ?? useAppStore.getState().token;

  if (!token) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token ?? null;
      if (token && !useAppStore.getState().token && data.session?.user) {
        // Sincronizar store si Supabase tenía sesión persistida
        useAppStore.getState().setSession({
          token,
          userId: data.session.user.id,
          zoneId:
            data.session.user.user_metadata?.zone_id ||
            useAppStore.getState().zoneId ||
            '',
          userFullName: data.session.user.user_metadata?.full_name,
          userEmail: data.session.user.email,
        });
      }
    } catch {
      // Ignorar fallo al leer sesión si no hay conexión
    }
  }

  // 2. Interceptor de cabeceras
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  // 3. Ejecutar petición HTTP
  let res: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    logger.debug('API_CLIENT', `Petición HTTP ${method} -> ${url}`);
    res = await fetch(url, {
      signal: controller.signal,
      ...options,
      headers,
    });
  } catch (netErr: any) {
    const netMsg = netErr?.message || 'Error de conexión / Servidor inaccesible';
    logger.error('API_CLIENT', `Fallo de red en ${method} ${url}`, {
      status: 0,
      url,
      method,
      error: netMsg,
    });
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      `No se pudo conectar con el servidor (${url}). Verifica que el backend esté encendido.`
    );
  } finally {
    clearTimeout(timer);
  }

  // 4. Procesar respuesta del servidor
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const errorMsg =
      (typeof body === 'object' && body !== null && (body.error || body.message)) ||
      `Error HTTP ${res.status}: ${res.statusText}`;
    const errorCode =
      (typeof body === 'object' && body !== null && (body.code?.toString() || body.errorCode)) ||
      res.status.toString();

    // Observabilidad: Registrar status HTTP, URL y payload de error devuelto por el backend
    logger.error('API_CLIENT', `Error HTTP ${res.status} en ${method} ${url}`, {
      status: res.status,
      url,
      method,
      payload: body,
      code: errorCode,
      message: errorMsg,
    });

    throw new ApiError(res.status, errorCode, errorMsg);
  }

  logger.debug('API_CLIENT', `Respuesta exitosa HTTP ${res.status} de ${method} ${url}`);

  // 5. Desenvolver envoltura estándar de la API { success: true, data: T } si aplica
  if (typeof body === 'object' && body !== null && 'data' in body && 'success' in body) {
    return (body as ApiResponse<T>).data;
  }

  return body as T;
}

export const api = {
  get: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
