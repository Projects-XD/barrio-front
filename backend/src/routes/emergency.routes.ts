import { Router } from 'express';
import { emergencyController } from '../controllers/emergency.controller';
import { requireAuth } from '../middlewares/requireAuth';
import { validate, toggleEmergencyStateSchema } from '../utils/validators';

const router = Router();

router.get('/', (req, res, next) => emergencyController.getState(req, res, next));
router.get('/services', (req, res, next) => emergencyController.listServices(req, res, next));

router.post(
  '/',
  requireAuth,
  validate(toggleEmergencyStateSchema),
  (req, res, next) => emergencyController.setState(req, res, next)
);

export default router;
