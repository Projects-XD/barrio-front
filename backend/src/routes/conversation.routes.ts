import { Router } from 'express';
import { conversationController } from '../controllers/conversation.controller';
import { requireAuth } from '../middlewares/requireAuth';
import {
  validate,
  uuidParamSchema,
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  sendMessageSchema,
  updateConversationSchema,
  reportConversationUserSchema,
} from '../utils/validators';

const router = Router();

/**
 * @openapi
 * /conversations:
 *   get:
 *     summary: Listar las conversaciones del usuario (como autor del favor o como quien respondió)
 *     tags:
 *       - Chat
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: favor_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Limita el resultado a las conversaciones de un favor
 *     responses:
 *       200:
 *         description: Conversaciones, la más reciente primero
 */
router.get(
  '/',
  requireAuth,
  validate(listConversationsQuerySchema, 'query'),
  (req, res, next) => conversationController.list(req, res, next)
);

/**
 * @openapi
 * /conversations/{id}:
 *   get:
 *     summary: Detalle de una conversación
 *     tags:
 *       - Chat
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
 *         description: Conversación con el favor y los dos participantes
 *       404:
 *         description: No existe o el usuario no participa en ella
 *   patch:
 *     summary: Silenciar la conversación (solo para quien lo pide) o cerrarla
 *     tags:
 *       - Chat
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               muted:
 *                 type: boolean
 *               closed:
 *                 type: boolean
 *                 enum: [true]
 *     responses:
 *       200:
 *         description: Conversación actualizada
 */
router.get(
  '/:id',
  requireAuth,
  validate(uuidParamSchema, 'params'),
  (req, res, next) => conversationController.get(req, res, next)
);

router.patch(
  '/:id',
  requireAuth,
  validate(uuidParamSchema, 'params'),
  validate(updateConversationSchema),
  (req, res, next) => conversationController.update(req, res, next)
);

/**
 * @openapi
 * /conversations/{id}/messages:
 *   get:
 *     summary: Últimos mensajes de la conversación, en orden cronológico
 *     description: Marca como leídos los mensajes del otro vecino. La app lo consulta cada pocos segundos.
 *     tags:
 *       - Chat
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *     responses:
 *       200:
 *         description: Mensajes
 *   post:
 *     summary: Enviar un mensaje
 *     description: Máximo 1000 caracteres y 15 mensajes por minuto. Falla si la conversación está cerrada o hay un bloqueo.
 *     tags:
 *       - Chat
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
 *             required: [body]
 *             properties:
 *               body:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       201:
 *         description: Mensaje enviado
 *       403:
 *         description: Bloqueo entre los dos vecinos
 *       409:
 *         description: Conversación cerrada
 *       429:
 *         description: Demasiados mensajes en el último minuto
 */
router.get(
  '/:id/messages',
  requireAuth,
  validate(uuidParamSchema, 'params'),
  validate(listMessagesQuerySchema, 'query'),
  (req, res, next) => conversationController.listMessages(req, res, next)
);

router.post(
  '/:id/messages',
  requireAuth,
  validate(uuidParamSchema, 'params'),
  validate(sendMessageSchema),
  (req, res, next) => conversationController.sendMessage(req, res, next)
);

/**
 * @openapi
 * /conversations/{id}/block:
 *   post:
 *     summary: Bloquear al otro vecino
 *     description: Cierra las conversaciones abiertas entre ambos e impide que le responda a tus favores o te escriba.
 *     tags:
 *       - Chat
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
 *         description: Vecino bloqueado
 */
router.post(
  '/:id/block',
  requireAuth,
  validate(uuidParamSchema, 'params'),
  (req, res, next) => conversationController.block(req, res, next)
);

/**
 * @openapi
 * /conversations/{id}/block:
 *   delete:
 *     summary: Desbloquear al otro vecino
 *     description: Solo quita el bloqueo que pusiste tú y reabre las conversaciones entre ambos.
 *     tags:
 *       - Chat
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
 *         description: Vecino desbloqueado
 */
router.delete(
  '/:id/block',
  requireAuth,
  validate(uuidParamSchema, 'params'),
  (req, res, next) => conversationController.unblock(req, res, next)
);

/**
 * @openapi
 * /conversations/{id}/report:
 *   post:
 *     summary: Reportar al otro vecino para moderación
 *     tags:
 *       - Chat
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
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [spam, contenido_inapropiado, datos_falsos, acoso, otro]
 *               details:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Reporte registrado
 */
router.post(
  '/:id/report',
  requireAuth,
  validate(uuidParamSchema, 'params'),
  validate(reportConversationUserSchema),
  (req, res, next) => conversationController.report(req, res, next)
);

export default router;
