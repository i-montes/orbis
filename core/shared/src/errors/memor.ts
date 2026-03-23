import { OrbisError } from './base.js';

export class MemorError extends OrbisError {
  constructor(message: string, code: string = 'MEMOR_ERROR', cause?: unknown) {
    super(message, { code, module: 'memor', cause });
  }
}
