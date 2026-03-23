import { OrbisError } from './base.js';

export class EmbeddingError extends OrbisError {
  constructor(message: string, code: string = 'EMBEDDING_ERROR', cause?: unknown) {
    super(message, { code, module: 'memor', cause });
  }
}
