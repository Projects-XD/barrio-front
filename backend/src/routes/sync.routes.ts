import { Router } from 'express';
import { syncController } from '../controllers/sync.controller';
import { requireAuth } from '../middlewares/requireAuth';
import { validate, syncBatchSchema } from '../utils/validators';

const router = Router();

/**
 * @openapi
 * /sync:
 *   post:
 *     summary: Motor de sincronización offline con garantía de idempotencia
 *     description: |
 *       Recibe un array de operaciones generadas offline por el cliente móvil.
 *       Verifica idempotencia mediante client_id en la tabla sync_operations para evitar duplicados.
 *     tags:
 *       - Sincronización Offline
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required:
 *                 - client_id
 *                 - operation
 *                 - payload
 *               properties:
 *                 client_id:
 *                   type: string
 *                   format: uuid
 *                 operation:
 *                   type: string
 *                   example: create_favor
 *                 payload:
 *                   type: object
 *     responses:
 *       200:
 *         description: Resultado secuencial del lote procesado (enviado, ignorado o error)
 */
router.post(
  '/',
  requireAuth,
  validate(syncBatchSchema),
  (req, res, next) => syncController.sync(req, res, next)
);

export default router;
