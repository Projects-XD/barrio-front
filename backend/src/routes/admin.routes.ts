import { Router, type Request, type Response, type NextFunction } from 'express';
import { getSupabaseClient } from '../config/supabase';
import { requireAuth } from '../middlewares/requireAuth';
import { requireAdmin } from '../middlewares/requireAdmin';
import { moderationService } from '../services/moderation.service';
import { validate, listPendingFavorsQuerySchema, rejectFavorSchema } from '../utils/validators';

const router = Router();

// Montado a nivel de router para que ninguna ruta de admin pueda omitirlo.
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
