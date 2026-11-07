import { Router } from 'express';
import { resourceController } from '../controllers/resource.controller';
import { requireAuth } from '../middlewares/requireAuth';
import { validate, createCriticalResourceSchema } from '../utils/validators';

const router = Router();

router.get('/', (req, res, next) => resourceController.list(req, res, next));
router.post(
  '/',
  requireAuth,
  validate(createCriticalResourceSchema),
  (req, res, next) => resourceController.create(req, res, next)
);

export default router;
