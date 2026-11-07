import { env } from '../config/env';

export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';

const LOG_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const LOG_COLORS: Record<LogLevel, string> = {
  error: '\x1b[31m', // Rojo
  warn: '\x1b[33m',  // Amarillo
  info: '\x1b[32m',  // Verde
  http: '\x1b[35m',  // Magenta
  debug: '\x1b[36m', // Cyan
};

const RESET_COLOR = '\x1b[0m';

class BackendLogger {
  private currentLevel: LogLevel = env.NODE_ENV === 'production' ? 'info' : 'debug';

  private canLog(level: LogLevel): boolean {
    return LOG_PRIORITY[level] <= LOG_PRIORITY[this.currentLevel];
  }

  private formatMessage(level: LogLevel, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString();
    const color = LOG_COLORS[level] || '';
    const levelTag = `${color}[${level.toUpperCase()}]${RESET_COLOR}`;
    let output = `[${timestamp}] ${levelTag} ${message}`;

    if (meta !== undefined) {
      if (meta instanceof Error) {
        output += `\n${meta.stack || meta.message}`;
      } else if (typeof meta === 'object' && meta !== null) {
        try {
          output += ` ${JSON.stringify(meta, null, env.NODE_ENV === 'development' ? 2 : 0)}`;
        } catch {
          output += ` [Objeto no serializable]`;
        }
      } else {
        output += ` ${String(meta)}`;
      }
    }

    return output;
  }

  public error(message: string, meta?: unknown): void {
    if (this.canLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  public warn(message: string, meta?: unknown): void {
    if (this.canLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  public info(message: string, meta?: unknown): void {
    if (this.canLog('info')) {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  public http(message: string, meta?: unknown): void {
    if (this.canLog('http')) {
      console.log(this.formatMessage('http', message, meta));
    }
  }

  public debug(message: string, meta?: unknown): void {
    if (this.canLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }
}

export const logger = new BackendLogger();
export default logger;
