import winston from 'winston';
import { env } from '../config/env';

const isProduction = env.NODE_ENV === 'production';

/**
 * Formato legible para desarrollo: timestamp, nivel coloreado, mensaje y metadata (stack incluido).
 */
const devFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ level: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaKeys = Object.keys(meta);
    const metaString = metaKeys.length > 0 ? ` ${JSON.stringify(meta, null, 2)}` : '';
    const stackString = stack ? `\n${String(stack)}` : '';
    return `[${String(timestamp)}] ${level} ${String(message)}${metaString}${stackString}`;
  })
);

/**
 * Formato JSON estructurado para producción (apto para agregadores de logs).
 */
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: false }),
  winston.format.json()
);

const baseLogger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: isProduction ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
});

/**
 * Normaliza el segundo argumento: acepta Error, objetos o valores primitivos.
 */
function normalizeMeta(meta?: unknown): Record<string, unknown> {
  if (meta === undefined) return {};
  if (meta instanceof Error) {
    return { stack: isProduction ? undefined : meta.stack, errorMessage: meta.message };
  }
  if (typeof meta === 'object' && meta !== null) {
    return meta as Record<string, unknown>;
  }
  return { detail: meta };
}

export const logger = {
  error: (message: string, meta?: unknown): void => {
    baseLogger.error(message, normalizeMeta(meta));
  },
  warn: (message: string, meta?: unknown): void => {
    baseLogger.warn(message, normalizeMeta(meta));
  },
  info: (message: string, meta?: unknown): void => {
    baseLogger.info(message, normalizeMeta(meta));
  },
  http: (message: string, meta?: unknown): void => {
    baseLogger.http(message, normalizeMeta(meta));
  },
  debug: (message: string, meta?: unknown): void => {
    baseLogger.debug(message, normalizeMeta(meta));
  },
};

export default logger;
