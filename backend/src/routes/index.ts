import { Router } from 'express';
import healthRoutes from './health.routes';
import profileRoutes from './profile.routes';
import favorRoutes from './favor.routes';
import emergencyRoutes from './emergency.routes';
import vulnerabilityRoutes from './vulnerability.routes';
import resourceRoutes from './resource.routes';
import syncRoutes from './sync.routes';
import zoneRoutes from './zone.routes';
import adminRoutes from './admin.routes';

const apiRouter = Router();

// Módulo "Día a Día", "Emergencias" y Sincronización Offline de la API Barrio
apiRouter.use('/health', healthRoutes);
apiRouter.use('/profiles', profileRoutes);
apiRouter.use('/favors', favorRoutes);
apiRouter.use('/emergency', emergencyRoutes);
apiRouter.use('/reports', vulnerabilityRoutes);
apiRouter.use('/resources', resourceRoutes);
apiRouter.use('/sync', syncRoutes);
apiRouter.use('/zones', zoneRoutes);
apiRouter.use('/admin', adminRoutes);

export default apiRouter;

