import { OrbisError } from './base.js';

export class ConfigError extends OrbisError {
  constructor(message: string, code: string = 'CONFIG_ERROR', cause?: unknown) {
    super(message, { code, module: 'shared', cause });
  }
}
