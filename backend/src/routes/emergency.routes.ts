import { Router } from 'express';
import { emergencyController } from '../controllers/emergency.controller';
import { requireAuth } from '../middlewares/requireAuth';
import {
  validate,
  activateEmergencySchema,
  deactivateEmergencySchema,
  createEmergencyReportSchema,
  toggleEmergencyStateSchema,
} from '../utils/validators';

const router = Router();

/**
 * @openapi
 * /emergency:
 *   get:
 *     summary: Consultar estado actual de emergencia en una zona
 *     tags:
 *       - Módulo de Emergencia
 *     parameters:
 *       - in: query
 *         name: zone_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Estado actual de la emergencia (activa/inactiva)
 */
router.get('/', requireAuth, (req, res, next) => emergencyController.getState(req, res, next));

/**
 * @openapi
 * /emergency/services:
 *   get:
 *     summary: Listar directorio de entidades y servicios de soporte (bomberos, salud, etc.)
 *     tags:
 *       - Módulo de Emergencia
 *     parameters:
 *       - in: query
 *         name: zone_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lista de servicios de soporte
 */
router.get('/services', requireAuth, (req, res, next) => emergencyController.listServices(req, res, next));

/**
 * @openapi
 * /emergency/activate:
 *   post:
 *     summary: Activar estado de emergencia barrial (Requiere emergency_role = true)
 *     tags:
 *       - Módulo de Emergencia
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - zone_id
 *               - reason
 *             properties:
 *               zone_id:
 *                 type: string
 *                 format: uuid
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Emergencia activada exitosamente
 *       403:
 *         description: Acceso denegado (el usuario no tiene emergency_role = true)
 */
router.post(
  '/activate',
  requireAuth,
  validate(activateEmergencySchema),
  (req, res, next) => emergencyController.activate(req, res, next)
);

/**
 * @openapi
 * /emergency/deactivate:
 *   post:
 *     summary: Desactivar estado de emergencia barrial (Requiere emergency_role = true)
 *     tags:
 *       - Módulo de Emergencia
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - zone_id
 *             properties:
 *               zone_id:
 *                 type: string
 *                 format: uuid
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Emergencia desactivada exitosamente
 *       403:
 *         description: Acceso denegado (el usuario no tiene emergency_role = true)
 */
router.post(
  '/deactivate',
  requireAuth,
  validate(deactivateEmergencySchema),
  (req, res, next) => emergencyController.deactivate(req, res, next)
);

/**
 * @openapi
 * /emergency/reports:
 *   post:
 *     summary: Reportar una persona o familia en situación de vulnerabilidad
 *     description: Las coordenadas (lat/lng) se redondean matemáticamente a 3 decimales (~111m de precisión) por privacidad.
 *     tags:
 *       - Módulo de Emergencia
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *             properties:
 *               zone_id:
 *                 type: string
 *                 format: uuid
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *               description:
 *                 type: string
 *               needs:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_anonymous:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Reporte registrado exitosamente
 */
router.post(
  '/reports',
  requireAuth,
  validate(createEmergencyReportSchema),
  (req, res, next) => emergencyController.createReport(req, res, next)
);

/**
 * @openapi
 * /emergency/reports:
 *   get:
 *     summary: Listar alertas y reportes comunitarios de vulnerabilidad
 *     description: Si el reporte fue marcado como anónimo (is_anonymous = true), el JSON omite reporter_user_id y datos personales.
 *     tags:
 *       - Módulo de Emergencia
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: "{ items, total, can_resolve } — solo reportes activos y no vencidos (TTL 6 h)"
 */
router.get('/reports', requireAuth, (req, res, next) => emergencyController.listReports(req, res, next));

/**
 * @openapi
 * /emergency/reports/{id}/resolve:
 *   patch:
 *     summary: Marcar un reporte como resuelto (admin o emergency_role)
 *     tags:
 *       - Módulo de Emergencia
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
 *         description: Reporte resuelto
 *       403:
 *         description: Sin permisos
 *       404:
 *         description: No existe en tu zona o ya estaba resuelto
 */
router.patch('/reports/:id/resolve', requireAuth, (req, res, next) =>
  emergencyController.resolveReport(req, res, next)
);

// Ruta legacy para toggle general
router.post(
  '/',
  requireAuth,
  validate(toggleEmergencyStateSchema),
  (req, res, next) => emergencyController.setState(req, res, next)
);

export default router;
