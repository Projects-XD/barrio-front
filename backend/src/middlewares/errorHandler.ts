import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Clase personalizada para errores operacionales de la aplicación.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware global de manejo de excepciones con observabilidad estructurada.
 * Imprime el error completo, la ruta fallida y el req.body en la terminal.
 * Garantiza respuestas JSON homogéneas:
 * { success: false, error: "Mensaje", code: number }
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Error interno del servidor';

  // 1. Manejo de AppError (errores operacionales controlados)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }
  // 2. Manejo de errores de validación de Zod
  else if (err instanceof ZodError) {
    statusCode = 400;
    const details = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    message = `Datos inválidos: ${details}`;
  }
  // 3. Errores genéricos o de librerías
  else if (err instanceof Error) {
    message = err.message || message;
  }

  // Sanitización de seguridad para campos sensibles en el cuerpo de la petición
  let sanitizedBody: unknown = req.body;
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    const copy = { ...req.body };
    if ('password' in copy) copy.password = '[REDACTED]';
    if ('token' in copy) copy.token = '[REDACTED]';
    sanitizedBody = copy;
  }

  // LOG ESTRUCTURADO EN CONSOLA (Terminal del Backend)
  console.error('\n🚨 ================= [BACKEND ERROR LOG] =================');
  console.error(`📅 Timestamp:    ${new Date().toISOString()}`);
  console.error(`🛣️  Ruta fallida: ${req.method} ${req.originalUrl}`);
  console.error(`📊 Código HTTP:  ${statusCode}`);
  console.error(`💬 Mensaje:      ${message}`);
  console.error(`📦 req.body:     ${JSON.stringify(sanitizedBody, null, 2)}`);
  if (req.query && Object.keys(req.query).length > 0) {
    console.error(`🔍 req.query:    ${JSON.stringify(req.query, null, 2)}`);
  }
  if (err.stack) {
    console.error(`📚 Error Stack:  \n${err.stack}`);
  }
  console.error('=========================================================\n');

  // Registro adicional en logger de Winston
  logger.error(`Error HTTP ${statusCode} en ${req.method} ${req.originalUrl}: ${message}`, {
    method: req.method,
    route: req.originalUrl,
    statusCode,
    body: sanitizedBody,
    query: req.query,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  res.status(statusCode).json({
    success: false,
    error: message,
    code: statusCode,
  });
};
