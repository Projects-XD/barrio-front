import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { requireAuth } from '../middlewares/requireAuth';
import { validate, listNotificationsQuerySchema, notificationIdParamSchema } from '../utils/validators';

const router = Router();

/**
 * @openapi
 * /notifications:
 *   get:
 *     summary: Listar las notificaciones del usuario autenticado
 *     tags:
 *       - Notificaciones
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 30
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - in: query
 *         name: unread
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: Con "true" devuelve solo las no leídas
 *     responses:
 *       200:
 *         description: Notificaciones, las más recientes primero
 */
router.get(
  '/',
  requireAuth,
  validate(listNotificationsQuerySchema, 'query'),
  (req, res, next) => notificationController.list(req, res, next)
);

/**
 * @openapi
 * /notifications/unread-count:
 *   get:
 *     summary: Cantidad de notificaciones sin leer
 *     tags:
 *       - Notificaciones
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Objeto con el campo count
 */
router.get('/unread-count', requireAuth, (req, res, next) =>
  notificationController.unreadCount(req, res, next)
);

/**
 * @openapi
 * /notifications/{id}/read:
 *   patch:
 *     summary: Marcar una notificación como leída
 *     tags:
 *       - Notificaciones
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
 *         description: Notificación marcada como leída
 *       404:
 *         description: No existe o no es del usuario
 */
router.patch(
  '/:id/read',
  requireAuth,
  validate(notificationIdParamSchema, 'params'),
  (req, res, next) => notificationController.markAsRead(req, res, next)
);

/**
 * @openapi
 * /notifications/read:
 *   delete:
 *     summary: Eliminar todas las notificaciones ya leídas
 *     tags:
 *       - Notificaciones
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Objeto con el campo deleted (cantidad borrada)
 */
// Va antes de /:id para que "read" no se tome como id.
router.delete('/read', requireAuth, (req, res, next) => notificationController.removeRead(req, res, next));

/**
 * @openapi
 * /notifications/{id}:
 *   delete:
 *     summary: Eliminar una notificación propia
 *     tags:
 *       - Notificaciones
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
 *         description: Notificación eliminada
 *       404:
 *         description: No existe o no es del usuario
 */
router.delete(
  '/:id',
  requireAuth,
  validate(notificationIdParamSchema, 'params'),
  (req, res, next) => notificationController.remove(req, res, next)
);

export default router;
