import { Router } from 'express';
import healthRoutes from './health.routes';
import profileRoutes from './profile.routes';
import vouchRoutes from './vouch.routes';
import favorRoutes from './favor.routes';
import emergencyRoutes from './emergency.routes';
import vulnerabilityRoutes from './vulnerability.routes';
import resourceRoutes from './resource.routes';

const apiRouter = Router();

// Registro modular de rutas de la API Barrio
apiRouter.use('/health', healthRoutes);
apiRouter.use('/profiles', profileRoutes);
apiRouter.use('/profiles', vouchRoutes);
apiRouter.use('/favors', favorRoutes);
apiRouter.use('/emergency', emergencyRoutes);
apiRouter.use('/reports', vulnerabilityRoutes);
apiRouter.use('/resources', resourceRoutes);

export default apiRouter;
