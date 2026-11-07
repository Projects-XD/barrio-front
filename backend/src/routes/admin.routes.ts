import { Router, type Request, type Response, type NextFunction } from 'express';
import { getSupabaseClient, supabaseAdmin } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';
import { requireAuth } from '../middlewares/requireAuth';
import { requireAdmin } from '../middlewares/requireAdmin';
import { moderationService } from '../services/moderation.service';
import { validate, listPendingFavorsQuerySchema, rejectFavorSchema } from '../utils/validators';

const router = Router();

/**
 * @openapi
 * /admin/me:
 *   get:
 *     summary: Indicar si el usuario autenticado es administrador
 *     tags:
 *       - Administración
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Objeto con is_admin en true o false
 *       401:
 *         description: No autenticado
 */
// Antes de requireAdmin: no ser admin es una respuesta válida aquí. Usa los mismos criterios que
// requireAdmin para que nadie vea el panel y luego reciba 403 en sus rutas.
router.get('/me', requireAuth, (req: Request, res: Response, next: NextFunction): void => {
  supabaseAdmin
    .from('users')
    .select('is_admin, status, zone_id')
    .eq('id', req.user!.id)
    .maybeSingle()
    .then(({ data: user, error }) => {
      if (error) throw new AppError('No se pudo verificar el rol de administrador', 500);
      const isAdmin = Boolean(user?.is_admin && user.status === 'active' && user.zone_id);
      res.json({ success: true, data: { is_admin: isAdmin }, code: 200 });
    })
    .then(undefined, next);
});

// Montado a nivel de router para que ninguna de las rutas siguientes pueda omitirlo.
router.use(requireAuth, requireAdmin);

// requireAuth y requireAdmin ya garantizan user y adminZoneId.
const handle =
  (
    action: (req: Request, adminId: string, zoneId: string) => Promise<unknown>
  ) =>
  (req: Request, res: Response, next: NextFunction): void => {
    action(req, req.user!.id, req.adminZoneId!)
      .then((data) => res.json({ success: true, data, code: 200 }))
      .catch(next);
  };

/**
 * @openapi
 * /admin/favors/pending:
 *   get:
 *     summary: Listar la cola de favores urgentes pendientes de la zona del admin
 *     tags:
 *       - Administración
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *     responses:
 *       200:
 *         description: Favores pendientes, los más antiguos primero
 *       401:
 *         description: No autenticado
 *       403:
 *         description: El usuario no es administrador activo con zona
 */
router.get(
  '/favors/pending',
  validate(listPendingFavorsQuerySchema, 'query'),
  handle((req, _adminId, zoneId) =>
    moderationService.listPending(getSupabaseClient(req), zoneId, {
      limit: Number(req.query.limit),
      offset: Number(req.query.offset),
    })
  )
);

/**
 * @openapi
 * /admin/reports:
 *   get:
 *     summary: Listar los reportes entre vecinos de la zona del admin
 *     tags:
 *       - Administración
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *     responses:
 *       200:
 *         description: Reportes con quien reporta y el reportado, los más recientes primero
 *       401:
 *         description: No autenticado
 *       403:
 *         description: El usuario no es administrador activo con zona
 */
router.get(
  '/reports',
  validate(listPendingFavorsQuerySchema, 'query'),
  handle((req, _adminId, zoneId) =>
    moderationService.listReports(getSupabaseClient(req), zoneId, {
      limit: Number(req.query.limit),
      offset: Number(req.query.offset),
    })
  )
);

/**
 * @openapi
 * /admin/favors/{id}/approve:
 *   patch:
 *     summary: Aprobar la urgencia de un favor pendiente
 *     tags:
 *       - Administración
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Favor aprobado
 *       403:
 *         description: No es admin, el favor es de otra zona o es del propio admin
 *       404:
 *         description: Favor no encontrado
 *       409:
 *         description: El favor ya no está pendiente
 */
router.patch(
  '/favors/:id/approve',
  handle((req, adminId, zoneId) =>
    moderationService.approve(getSupabaseClient(req), adminId, zoneId, String(req.params.id))
  )
);

/**
 * @openapi
 * /admin/favors/{id}/reject:
 *   patch:
 *     summary: Rechazar un favor pendiente y retirarlo (soft-delete)
 *     tags:
 *       - Administración
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Favor rechazado y retirado
 *       400:
 *         description: Falta el motivo o no es válido
 *       403:
 *         description: No es admin, el favor es de otra zona o es del propio admin
 *       404:
 *         description: Favor no encontrado
 *       409:
 *         description: El favor ya no está pendiente
 */
router.patch(
  '/favors/:id/reject',
  validate(rejectFavorSchema),
  handle((req, adminId, zoneId) =>
    moderationService.reject(
      getSupabaseClient(req),
      adminId,
      zoneId,
      String(req.params.id),
      req.body.reason
    )
  )
);

export default router;
