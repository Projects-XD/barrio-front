import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

/**
 * Entry point del servidor Backend de Barrio con observabilidad estructurada.
 */
const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Servidor Backend Barrio iniciado exitosamente en puerto ${env.PORT}`, {
    entorno: env.NODE_ENV,
    puerto: env.PORT,
    apiBase: `http://localhost:${env.PORT}/api/v1`,
    healthCheck: `http://localhost:${env.PORT}/api/v1/health`,
    supabaseUrl: env.SUPABASE_URL,
  });
});

// Manejo de apagado elegante (Graceful Shutdown)
function handleShutdown(signal: string): void {
  logger.info(`🛑 Señal ${signal} recibida. Cerrando conexiones del servidor HTTP...`);
  server.close(() => {
    logger.info('✅ Servidor HTTP cerrado correctamente.');
    process.exit(0);
  });

  // Forzar apagado después de 10 segundos si hay peticiones colgadas
  setTimeout(() => {
    logger.error('⚠️ Apagado forzado por tiempo límite excedido (10s).');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('💥 Unhandled Rejection detectado en el proceso Node:', reason);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('💥 Uncaught Exception detectado en el proceso Node:', error);
  process.exit(1);
});
