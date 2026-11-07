import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { createAuthCache } from '../utils/authCache';

// Supabase Auth suma ~150 ms a cada petición y el chat consulta cada 4 s.
const AUTH_CACHE_TTL_MS = 30_000;
const verifyToken = createAuthCache((token) => supabaseAdmin.auth.getUser(token), AUTH_CACHE_TTL_MS);

/**
 * Middleware que verifica la autenticación mediante token Bearer.
 * Valida el JWT contra Supabase Auth (con caché de AUTH_CACHE_TTL_MS).
 * Si es válido, inyecta `user` y `token` en el objeto `req`.
 * Si falla, responde con código HTTP 401.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Token de autorización requerido (Formato: Bearer <token>)',
        code: 401,
      });
      return;
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Token de autorización vacío o ausente',
        code: 401,
      });
      return;
    }

    const {
      data: { user },
      error,
    } = await verifyToken(token);

    if (error || !user) {
      res.status(401).json({
        success: false,
        error: error?.message || 'Sesión inválida o expirada',
        code: 401,
      });
      return;
    }

    // Inyectar datos del usuario autenticado en la solicitud Express
    req.user = user;
    req.token = token;

    next();
  } catch (err) {
    next(err);
  }
}
