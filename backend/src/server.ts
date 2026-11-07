import { app } from './app';
import { env } from './config/env';

/**
 * Entry point del servidor Backend de Barrio.
 */
const server = app.listen(env.PORT, () => {
  console.log(`
  ======================================================
  🚀 Servidor Backend Barrio iniciado exitosamente
  ======================================================
  📡 Entorno:       ${env.NODE_ENV}
  🔌 Puerto:        ${env.PORT}
  🌐 Endpoint Base: http://localhost:${env.PORT}/api/v1
  🩺 Health Check:  http://localhost:${env.PORT}/api/v1/health
  ⚡ Supabase URL:  ${env.SUPABASE_URL}
  ======================================================
  `);
});

// Manejo de apagado elegante (Graceful Shutdown)
function handleShutdown(signal: string): void {
  console.log(`\n🛑 Señal ${signal} recibida. Cerrando conexiones del servidor...`);
  server.close(() => {
    console.log('✅ Servidor HTTP cerrado correctamente.');
    process.exit(0);
  });

  // Forzar apagado después de 10 segundos si hay peticiones colgadas
  setTimeout(() => {
    console.error('⚠️ Apagado forzado por tiempo límite excedido.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  console.error('💥 Unhandled Rejection detectado:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('💥 Uncaught Exception detectado:', error);
  process.exit(1);
});
