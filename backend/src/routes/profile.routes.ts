import { Router } from 'express';
import { profileController } from '../controllers/profile.controller';
import { requireAuth } from '../middlewares/requireAuth';
import { validate, createProfessionalProfileSchema, updateProfessionalProfileSchema } from '../utils/validators';

const router = Router();

router.get('/', (req, res, next) => profileController.list(req, res, next));
router.get('/oficios', (req, res, next) => profileController.listOficios(req, res, next));
router.get('/:id', (req, res, next) => profileController.getById(req, res, next));

router.post(
  '/',
  requireAuth,
  validate(createProfessionalProfileSchema),
  (req, res, next) => profileController.create(req, res, next)
);

router.patch(
  '/:id',
  requireAuth,
  validate(updateProfessionalProfileSchema),
  (req, res, next) => profileController.update(req, res, next)
);

export default router;
