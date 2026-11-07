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

// 1. Listar favores activos (status = 'abierta' o 'en_curso') por zone_id
router.get(
  '/',
  validate(listFavorsQuerySchema, 'query'),
  (req, res, next) => favorController.list(req, res, next)
);

// 2. Crear favor vecinal
router.post(
  '/',
  requireAuth,
  validate(createFavorSchema),
  (req, res, next) => favorController.create(req, res, next)
);

// 3. Detalle de un favor
router.get('/:id', (req, res, next) => favorController.getById(req, res, next));

// 4. Actualizar favor
router.patch(
  '/:id',
  requireAuth,
  validate(updateFavorSchema),
  (req, res, next) => favorController.update(req, res, next)
);

// 5. Añadir registro en favor_interests (/interest e /interests)
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
