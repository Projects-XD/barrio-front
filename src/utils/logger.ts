export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Nivel mínimo configurable según el entorno
const CURRENT_LOG_LEVEL: LogLevel = __DEV__ ? 'debug' : 'info';

/**
 * Formatea argumentos y objetos de forma segura para evitar excepciones de serialización circular.
 */
function safeFormatData(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (arg instanceof Error) {
      return {
        name: arg.name,
        message: arg.message,
        stack: arg.stack,
      };
    }
    return arg;
  });
}

class Logger {
  private isEnabled(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LOG_LEVEL];
  }

  private print(level: LogLevel, tag: string, message: string, ...meta: unknown[]): void {
    if (!this.isEnabled(level)) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${tag}] ${message}`;
    const formattedMeta = safeFormatData(meta);

    switch (level) {
      case 'debug':
        if (formattedMeta.length > 0) {
          console.debug(prefix, ...formattedMeta);
        } else {
          console.debug(prefix);
        }
        break;
      case 'info':
        if (formattedMeta.length > 0) {
          console.info(prefix, ...formattedMeta);
        } else {
          console.info(prefix);
        }
        break;
      case 'warn':
        if (formattedMeta.length > 0) {
          console.warn(prefix, ...formattedMeta);
        } else {
          console.warn(prefix);
        }
        break;
      case 'error':
        if (formattedMeta.length > 0) {
          console.error(prefix, ...formattedMeta);
        } else {
          console.error(prefix);
        }
        break;
    }
  }

  public debug(tag: string, message: string, ...meta: unknown[]): void {
    this.print('debug', tag, message, ...meta);
  }

  public info(tag: string, message: string, ...meta: unknown[]): void {
    this.print('info', tag, message, ...meta);
  }

  public warn(tag: string, message: string, ...meta: unknown[]): void {
    this.print('warn', tag, message, ...meta);
  }

  public error(tag: string, message: string, ...meta: unknown[]): void {
    this.print('error', tag, message, ...meta);
  }
}

export const logger = new Logger();
export default logger;
