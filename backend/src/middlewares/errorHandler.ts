import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';

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
 * Middleware global de manejo de excepciones.
 * Garantiza respuestas JSON homogéneas con formato:
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

  // Registro del error en logs
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}]  Error ${statusCode} en ${req.method} ${req.originalUrl}:`, {
    message: err.message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  res.status(statusCode).json({
    success: false,
    error: message,
    code: statusCode,
  });
};
