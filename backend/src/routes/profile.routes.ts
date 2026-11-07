import { Router } from 'express';
import { profileController } from '../controllers/profile.controller';
import { requireAuth } from '../middlewares/requireAuth';
import {
  validate,
  listProfilesQuerySchema,
  upsertProfessionalProfileSchema,
} from '../utils/validators';

const router = Router();

// 1. Catálogo de oficios disponibles
router.get('/oficios', (req, res, next) => profileController.listOficios(req, res, next));

// 2. Listado de perfiles profesionales filtrados por zone_id y oficio_id
router.get(
  '/',
  validate(listProfilesQuerySchema, 'query'),
  (req, res, next) => profileController.list(req, res, next)
);

// 3. Crear o editar perfil profesional del usuario autenticado
router.post(
  '/',
  requireAuth,
  validate(upsertProfessionalProfileSchema),
  (req, res, next) => profileController.upsert(req, res, next)
);

// 4. Detalle de perfil profesional
router.get('/:id', (req, res, next) => profileController.getById(req, res, next));

// 5. Vistos buenos (Vouches)
router.post(
  '/:id/vouch',
  requireAuth,
  (req, res, next) => profileController.vouch(req, res, next)
);

router.delete(
  '/:id/vouch',
  requireAuth,
  (req, res, next) => profileController.removeVouch(req, res, next)
);

router.get(
  '/:id/vouch/status',
  requireAuth,
  (req, res, next) => profileController.checkVouchStatus(req, res, next)
);

export default router;
