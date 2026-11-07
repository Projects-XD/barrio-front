import { Router } from 'express';
import { favorController } from '../controllers/favor.controller';
import { requireAuth } from '../middlewares/requireAuth';
import {
  validate,
  createFavorSchema,
  updateFavorSchema,
  createFavorInterestSchema,
  listFavorsQuerySchema,
  reportFavorSchema,
} from '../utils/validators';

const router = Router();

/**
 * @openapi
 * /favors:
 *   get:
 *     summary: Listar favores activos por zona
 *     description: Solo devuelve favores aprobados, más los del propio usuario autenticado en cualquier estado de moderación.
 *     tags:
 *       - Favores Vecinales
 *     parameters:
 *       - in: query
 *         name: zone_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la zona barrial
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [herramienta, ayuda_temporal, donacion_materiales, intercambio_habilidades, movilidad_solidaria]
 *     responses:
 *       200:
 *         description: Lista de favores aprobados de la zona y favores propios
 */
router.get(
  '/',
  requireAuth,
  validate(listFavorsQuerySchema, 'query'),
  (req, res, next) => favorController.list(req, res, next)
);

/**
 * @openapi
 * /favors:
 *   post:
 *     summary: Crear un nuevo favor comunitario
 *     description: Todo favor nace con moderation_status aprobado y es visible de inmediato en el feed de la zona. Los reportes de vecinos pueden ocultarlo después.
 *     tags:
 *       - Favores Vecinales
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - client_id
 *               - type
 *               - title
 *             properties:
 *               client_id:
 *                 type: string
 *                 format: uuid
 *                 description: UUID único generado por el cliente móvil para garantizar idempotencia
 *               zone_id:
 *                 type: string
 *                 format: uuid
 *               type:
 *                 type: string
 *                 enum: [herramienta, ayuda_temporal, donacion_materiales, intercambio_habilidades, movilidad_solidaria]
 *               title:
 *                 type: string
 *                 maxLength: 120
 *               description:
 *                 type: string
 *               location_lat:
 *                 type: number
 *               location_lng:
 *                 type: number
 *               urgency:
 *                 type: string
 *                 enum: [normal, urgente, emergencia]
 *                 default: normal
 *                 description: Nivel de urgencia. No cambia la moderación; la insignia solo se muestra si el favor está aprobado.
 *     responses:
 *       201:
 *         description: Favor creado y publicado
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autenticado
 */
router.post(
  '/',
  requireAuth,
  validate(createFavorSchema),
  (req, res, next) => favorController.create(req, res, next)
);

/**
 * @openapi
 * /favors/{id}:
 *   get:
 *     summary: Obtener el detalle de un favor por ID
 *     tags:
 *       - Favores Vecinales
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Detalle del favor, autor y lista de vecinos interesados
 *       404:
 *         description: Favor no encontrado
 */
router.get('/:id', requireAuth, (req, res, next) => favorController.getById(req, res, next));

/**
 * @openapi
 * /favors/{id}:
 *   patch:
 *     summary: Editar, cambiar de estado o asignar un favor
 *     description: Editar título, descripción o tipo no cambia la moderación del favor. Cambiar solo el estado o la asignación tampoco la afecta.
 *     tags:
 *       - Favores Vecinales
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
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 120
 *               description:
 *                 type: string
 *                 nullable: true
 *               type:
 *                 type: string
 *                 enum: [herramienta, ayuda_temporal, donacion_materiales, intercambio_habilidades, movilidad_solidaria, otros]
 *               status:
 *                 type: string
 *                 enum: [abierta, en_curso, cerrada, cancelada]
 *               assigned_to_user_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Favor actualizado exitosamente
 *       403:
 *         description: Favor desactivado o plazo de edición de 24 horas vencido
 */
router.patch(
  '/:id',
  requireAuth,
  validate(updateFavorSchema),
  (req, res, next) => favorController.update(req, res, next)
);

/**
 * @openapi
 * /favors/{id}:
 *   delete:
 *     summary: Desactivar un favor propio (soft-delete)
 *     tags:
 *       - Favores Vecinales
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
 *         description: Favor desactivado
 *       404:
 *         description: Favor no encontrado o de otro autor
 */
router.delete('/:id', requireAuth, (req, res, next) => favorController.remove(req, res, next));

/**
 * @openapi
 * /favors/{id}/interest:
 *   post:
 *     summary: Expresar interés o postularse para ayudar en un favor
 *     tags:
 *       - Favores Vecinales
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
 *               message:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Interés registrado
 */
router.post(
  '/:id/interest',
  requireAuth,
  validate(createFavorInterestSchema),
  (req, res, next) => favorController.addInterest(req, res, next)
);

router.post(
  '/:id/report',
  requireAuth,
  validate(reportFavorSchema),
  (req, res, next) => favorController.report(req, res, next)
);

export default router;
