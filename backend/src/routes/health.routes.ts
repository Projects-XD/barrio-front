import { Router } from 'express';
import { healthController } from '../controllers/health.controller';

const router = Router();

/**
 * @route GET /health
 * @desc Comprueba el estado del servidor y la conectividad con Supabase
 * @access Público
 */
router.get('/', (req, res, next) => healthController.check(req, res, next));

export default router;
