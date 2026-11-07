import { Router } from 'express';
import { vouchController } from '../controllers/vouch.controller';
import { requireAuth } from '../middlewares/requireAuth';

const router = Router({ mergeParams: true });

router.post('/:profileId/vouch', requireAuth, (req, res, next) =>
  vouchController.give(req, res, next)
);

router.delete('/:profileId/vouch', requireAuth, (req, res, next) =>
  vouchController.remove(req, res, next)
);

router.get('/:profileId/vouch/status', requireAuth, (req, res, next) =>
  vouchController.checkStatus(req, res, next)
);

export default router;
