import { Router } from 'express';
import { profileController } from '../controllers/profile.controller';
import { requireAuth } from '../middlewares/requireAuth';
import {
  validate,
  listProfilesQuerySchema,
  upsertProfessionalProfileSchema,
} from '../utils/validators';

const router = Router();

/**
 * @openapi
 * /profiles/oficios:
 *   get:
 *     summary: Catálogo de oficios disponibles
 *     tags:
 *       - Oficios y Perfiles
 *     responses:
 *       200:
 *         description: Lista de oficios registrados en el sistema
 */
router.get('/oficios', (req, res, next) => profileController.listOficios(req, res, next));

/**
 * @openapi
 * /profiles:
 *   get:
 *     summary: Listado de perfiles profesionales por zona
 *     tags:
 *       - Oficios y Perfiles
 *     parameters:
 *       - in: query
 *         name: zone_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la zona barrial
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Categoría de oficio (gasfiteria, carpinteria, electricidad, etc.)
 *     responses:
 *       200:
 *         description: Lista de perfiles con estadísticas de vistos buenos
 */
router.get(
  '/',
  validate(listProfilesQuerySchema, 'query'),
  (req, res, next) => profileController.list(req, res, next)
);

/**
 * @openapi
 * /profiles:
 *   post:
 *     summary: Crear o actualizar el perfil profesional del usuario autenticado
 *     tags:
 *       - Oficios y Perfiles
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oficio_id
 *             properties:
 *               oficio_id:
 *                 type: string
 *                 format: uuid
 *               description:
 *                 type: string
 *               years_experience:
 *                 type: integer
 *               location_lat:
 *                 type: number
 *               location_lng:
 *                 type: number
 *     responses:
 *       201:
 *         description: Perfil profesional guardado exitosamente
 *       401:
 *         description: No autenticado
 */
router.post(
  '/',
  requireAuth,
  validate(upsertProfessionalProfileSchema),
  (req, res, next) => profileController.upsert(req, res, next)
);

/**
 * @openapi
 * /profiles/{id}:
 *   get:
 *     summary: Obtener el detalle de un perfil profesional por ID
 *     tags:
 *       - Oficios y Perfiles
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Detalle del perfil profesional y datos del vecino
 *       404:
 *         description: Perfil no encontrado
 */
router.get('/:id', (req, res, next) => profileController.getById(req, res, next));

/**
 * @openapi
 * /profiles/{id}/vouch:
 *   post:
 *     summary: Otorgar visto bueno vecinal a un profesional
 *     tags:
 *       - Oficios y Perfiles
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
 *       201:
 *         description: Visto bueno registrado
 */
router.post(
  '/:id/vouch',
  requireAuth,
  (req, res, next) => profileController.vouch(req, res, next)
);

/**
 * @openapi
 * /profiles/{id}/vouch:
 *   delete:
 *     summary: Remover visto bueno otorgado
 *     tags:
 *       - Oficios y Perfiles
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
 *         description: Visto bueno retirado
 */
router.delete(
  '/:id/vouch',
  requireAuth,
  (req, res, next) => profileController.removeVouch(req, res, next)
);

/**
 * @openapi
 * /profiles/{id}/vouch/status:
 *   get:
 *     summary: Consultar si el usuario actual ha otorgado visto bueno al perfil
 *     tags:
 *       - Oficios y Perfiles
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
 *         description: Estado del visto bueno (hasVouched boolean)
 */
router.get(
  '/:id/vouch/status',
  requireAuth,
  (req, res, next) => profileController.checkVouchStatus(req, res, next)
);

export default router;
