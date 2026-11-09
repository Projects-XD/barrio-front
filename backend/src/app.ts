import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import apiRouter from './routes';
import { errorHandler, AppError } from './middlewares/errorHandler';
import { swaggerSpec } from './config/swagger';

/**
 * Crea y configura la instancia de la aplicación Express.
 */
export function createApp(): Application {
  const app: Application = express();

  // Habilitar trust proxy para túneles (ngrok / cloudflare) y balanceadores
  app.set('trust proxy', 1);

  // 1. Middlewares de seguridad y parsing
  // En desarrollo desactivamos CSP estricto para permitir la renderización de la UI de Swagger
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production',
      crossOriginResourcePolicy: false,
    })
  );

  // Configuración de CORS permisiva para desarrollo y soporte móvil/web
  const corsOptions: cors.CorsOptions = {
    origin: env.NODE_ENV === 'production' ? env.CORS_ORIGIN : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  };

  app.use(cors(corsOptions));
  // Habilitar preflight requests para todas las rutas
  app.options('*', cors(corsOptions));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 2. Logging HTTP
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // 3. Documentación OpenAPI / Swagger
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Barrio API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  }));

  // 4. Rutas de la API (soportando /api y /api/v1)
  // Límites por IP. El tope general es alto porque el chat consulta cada 4 s; las escrituras
// (publicar, responder, reportar) tienen un tope propio más bajo.
const limitMessage = { success: false, error: 'Demasiadas peticiones. Intenta de nuevo en unos minutos.', code: 429 };
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: limitMessage,
});
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: limitMessage,
});
app.use('/api', generalLimiter, writeLimiter);

app.use('/api/v1', apiRouter);
  app.use('/api', apiRouter);

  // Ruta raíz de verificación básica
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'Barrio Backend API',
      version: '1.0.0',
      status: 'online',
      documentation: '/api/docs',
      health: '/api/v1/health',
    });
  });

  // 5. Manejo de rutas no encontradas (404)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404));
  });

  // 6. Middleware global de manejo de excepciones (debe ir al final)
  app.use(errorHandler);

  return app;
}

export const app = createApp();
