import type { Server } from 'http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

/**
 * Entry point del servidor Backend de Barrio con observabilidad estructurada.
 */
let server: Server;

function startServer(retriesLeft = 3): void {
  server = app.listen(env.PORT, () => {
    logger.info(`🚀 Servidor Backend Barrio iniciado exitosamente en puerto ${env.PORT}`, {
      entorno: env.NODE_ENV,
      puerto: env.PORT,
      apiBase: `http://localhost:${env.PORT}/api/v1`,
      healthCheck: `http://localhost:${env.PORT}/api/v1/health`,
      supabaseUrl: env.SUPABASE_URL,
    });
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      if (retriesLeft > 0) {
        logger.warn(
          `⏳ Puerto ${env.PORT} ocupado temporalmente. Reintentando en 1s... (${retriesLeft} intentos restantes)`
        );
        setTimeout(() => {
          server.close();
          startServer(retriesLeft - 1);
        }, 1000);
        return;
      }
      logger.error(
        `❌ El puerto ${env.PORT} ya está en uso por otra terminal o proceso. Cierra la otra terminal donde corre el backend o libera el puerto ${env.PORT}.`
      );
      process.exit(1);
    }

    logger.error('💥 Error en el servidor HTTP:', err);
    process.exit(1);
  });
}

startServer();

// Manejo de apagado elegante (Graceful Shutdown)
function handleShutdown(signal: string): void {
  logger.info(`🛑 Señal ${signal} recibida. Cerrando conexiones del servidor HTTP...`);
  if (server) {
    // Cerrar conexiones keep-alive inmediatamente para que tsx watch no provoque EADDRINUSE en Windows
    server.closeAllConnections?.();
    server.close(() => {
      logger.info('✅ Servidor HTTP cerrado correctamente.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }

  // Forzar apagado después de 2 segundos si hay peticiones colgadas
  setTimeout(() => {
    process.exit(0);
  }, 2000).unref();
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
