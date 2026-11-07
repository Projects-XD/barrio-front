import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import apiRouter from './routes';
import { errorHandler, AppError } from './middlewares/errorHandler';

/**
 * Crea y configura la instancia de la aplicación Express.
 */
export function createApp(): Application {
  const app: Application = express();

  // 1. Middlewares de seguridad y parsing
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 2. Logging HTTP
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // 3. Rutas de la API
  app.use('/api/v1', apiRouter);

  // Ruta raíz de verificación básica
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'Barrio Backend API',
      version: '1.0.0',
      status: 'online',
      documentation: '/api/v1/health',
    });
  });

  // 4. Manejo de rutas no encontradas (404)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404));
  });

  // 5. Middleware global de manejo de excepciones (debe ir al final)
  app.use(errorHandler);

  return app;
}

export const app = createApp();
