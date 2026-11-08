import { Router } from 'express';
import { profileController } from '../controllers/profile.controller';
import { requireAuth } from '../middlewares/requireAuth';
import {
  validate,
  listProfilesQuerySchema,
  upsertProfessionalProfileSchema,
  suggestDescriptionSchema,
  saveMyLocationSchema,
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

router.patch(
  '/me/location',
  requireAuth,
  validate(saveMyLocationSchema),
  (req, res, next) => profileController.saveMyLocation(req, res, next)
);

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
  requireAuth,
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
router.get('/:id', requireAuth, (req, res, next) => profileController.getById(req, res, next));

router.delete('/:id', requireAuth, (req, res, next) => profileController.remove(req, res, next));

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

/**
 * @openapi
 * /profiles/{id}/contact:
 *   post:
 *     summary: Iniciar o retomar conversación directa con un oficio
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
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               initial_message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conversación iniciada o recuperada
 */
router.post(
  '/:id/contact',
  requireAuth,
  (req, res, next) => profileController.contact(req, res, next)
);

/**
 * @openapi
 * /profiles/suggest-description:
 *   post:
 *     summary: Sugerir una descripción para un oficio con IA (Gemini)
 *     description: Máximo 5 sugerencias por hora por usuario. El texto es un borrador que el vecino edita antes de guardar.
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
 *             required: [category]
 *             properties:
 *               category:
 *                 type: string
 *               oficio_name:
 *                 type: string
 *               years_experience:
 *                 type: integer
 *               notes:
 *                 type: string
 *                 maxLength: 300
 *     responses:
 *       200:
 *         description: Borrador de descripción
 *       429:
 *         description: Límite de sugerencias por hora
 *       503:
 *         description: IA no configurada en el servidor
 */
router.post(
  '/suggest-description',
  requireAuth,
  validate(suggestDescriptionSchema),
  (req, res, next) => profileController.suggestDescription(req, res, next)
);

export default router;
