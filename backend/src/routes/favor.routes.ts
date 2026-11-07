import { Router } from 'express';
import { favorController } from '../controllers/favor.controller';
import { requireAuth } from '../middlewares/requireAuth';
import {
  validate,
  createFavorSchema,
  updateFavorSchema,
  createFavorInterestSchema,
  listFavorsQuerySchema,
} from '../utils/validators';

const router = Router();

/**
 * @openapi
 * /favors:
 *   get:
 *     summary: Listar favores activos por zona
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
 *         description: Lista de favores vecinales activos
 */
router.get(
  '/',
  validate(listFavorsQuerySchema, 'query'),
  (req, res, next) => favorController.list(req, res, next)
);

/**
 * @openapi
 * /favors:
 *   post:
 *     summary: Crear un nuevo favor comunitario
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
 *     responses:
 *       201:
 *         description: Favor creado exitosamente
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
router.get('/:id', (req, res, next) => favorController.getById(req, res, next));

/**
 * @openapi
 * /favors/{id}:
 *   patch:
 *     summary: Actualizar estado o asignar un favor
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
 *               status:
 *                 type: string
 *                 enum: [abierta, en_curso, cerrada, cancelada]
 *               assigned_to_user_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Favor actualizado exitosamente
 */
router.patch(
  '/:id',
  requireAuth,
  validate(updateFavorSchema),
  (req, res, next) => favorController.update(req, res, next)
);

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
  '/:id/interests',
  requireAuth,
  validate(createFavorInterestSchema),
  (req, res, next) => favorController.addInterest(req, res, next)
);

export default router;
