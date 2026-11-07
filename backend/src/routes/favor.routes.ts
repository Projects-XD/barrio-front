import { Router } from 'express';
import { favorController } from '../controllers/favor.controller';
import { requireAuth } from '../middlewares/requireAuth';
import { validate, createFavorSchema, updateFavorSchema, createFavorInterestSchema } from '../utils/validators';

const router = Router();

router.get('/', (req, res, next) => favorController.list(req, res, next));
router.get('/:id', (req, res, next) => favorController.getById(req, res, next));

router.post(
  '/',
  requireAuth,
  validate(createFavorSchema),
  (req, res, next) => favorController.create(req, res, next)
);

router.patch(
  '/:id',
  requireAuth,
  validate(updateFavorSchema),
  (req, res, next) => favorController.update(req, res, next)
);

router.post(
  '/:id/interests',
  requireAuth,
  validate(createFavorInterestSchema),
  (req, res, next) => favorController.expressInterest(req, res, next)
);

export default router;
