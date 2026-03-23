import { OrbisError } from './base.js';

export class DatabaseError extends OrbisError {
  constructor(message: string, code: string = 'DATABASE_ERROR', cause?: unknown) {
    super(message, { code, module: 'memor', cause });
  }
}
