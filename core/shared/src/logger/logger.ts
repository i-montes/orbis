import { formatPretty, formatJson } from './formatters.js';
import { getConfig } from '../config/loader.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private readonly level: LogLevel;
  private readonly format: 'pretty' | 'json';

  constructor(private readonly module: string) {
    try {
      // Capture config at the moment the logger is created
      const config = getConfig();
      this.level = (config.logger?.level as LogLevel) || 'info';
      this.format = config.logger?.format || 'pretty';
    } catch (e) {
      // Fallback if config is not available or during early bootstrapping
      this.level = 'info';
      this.format = 'pretty';
    }
  }

  private log(level: LogLevel, message: string, meta?: any) {
    try {
      // 1. Strict level check before any formatting
      if (LEVEL_WEIGHTS[level] < LEVEL_WEIGHTS[this.level]) {
        return;
      }

      // 2. Format based on captured configuration
      let formatted: string;
      if (this.format === 'json') {
        formatted = formatJson(level, this.module, message, meta);
      } else {
        formatted = formatPretty(level, this.module, message, meta);
      }

      // 3. Write directly to stdout
      process.stdout.write(formatted);
    } catch (e) {
      // Logger never throws
    }
  }

  debug(message: string, meta?: any) {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: any) {
    this.log('error', message, meta);
  }
}

export function createLogger(module: string): Logger {
  return new Logger(module);
}
