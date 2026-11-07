import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import { env } from './env';
import type { Database } from '../types/database.types';

/**
 * Cliente de Supabase con privilegios de Administrador (Service Role).
 * IMPORTANTE: Este cliente se salta completamente las políticas de Row Level Security (RLS).
 * Usar únicamente para tareas operativas internas, triggers de sincronización o endpoints administrativos.
 */
export const supabaseAdmin: SupabaseClient<Database> = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Crea un cliente de Supabase con el contexto de seguridad del usuario autenticado (RLS).
 * Utiliza la anon key junto al JWT del usuario en la cabecera Authorization para que PostgreSQL
 * aplique auth.uid() y las políticas RLS correspondientes.
 *
 * @param accessToken Token JWT del usuario (opcional si es para operaciones públicas con anon key)
 */
export function createSupabaseClient(
  accessToken?: string
): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Extrae el token de la petición Express y genera un cliente scoped a ese usuario.
 * @param req Request de Express
 */
export function getSupabaseClient(req: Request): SupabaseClient<Database> {
  const token =
    req.token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : undefined);

  return createSupabaseClient(token);
}
