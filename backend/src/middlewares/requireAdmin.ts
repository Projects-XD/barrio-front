import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from './errorHandler';

/**
 * Exige un administrador activo con zona. Va siempre después de requireAuth.
 * El rol se lee de public.users y nunca del JWT: la metadata de Auth la puede editar el propio usuario.
 * Deja la zona del admin en req.adminZoneId, que limita todo lo que puede moderar.
 */
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    next(new AppError('Usuario no autenticado', 401));
    return;
  }

  const { data: admin, error } = await supabaseAdmin
    .from('users')
    .select('is_admin, status, zone_id')
    .eq('id', req.user.id)
    .maybeSingle();

  if (error) {
    next(new AppError('No se pudo verificar el rol de administrador', 500));
    return;
  }

  if (!admin?.is_admin || admin.status !== 'active' || !admin.zone_id) {
    next(new AppError('Acceso denegado: se requiere rol de administrador', 403));
    return;
  }

  req.adminZoneId = admin.zone_id;
  next();
}
