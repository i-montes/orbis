import { createEmbeddingProvider, type OrbisEmbeddingProvider } from './provider.js';
import type { MemorStore } from '../store/store.js';
import { createLogger, EmbeddingError } from '@orbis/shared';

const logger = createLogger('memor:embedding:manager');

export class EmbeddingManager {
  private provider: OrbisEmbeddingProvider;
  private initialized: boolean = false;

  constructor(private store: MemorStore, providerAlias?: string) {
    this.provider = createEmbeddingProvider(providerAlias);
    logger.info(`Initialized EmbeddingManager with provider model: ${this.provider.model} (${this.provider.dimensions} dims)`);
  }

  /**
   * (Optional) Initializes the underlying provider if needed.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.provider.initialize) {
      logger.info(`Initializing provider: ${this.provider.model}...`);
      await this.provider.initialize();
    }
    this.initialized = true;
  }

  /**
   * Generates an embedding for the given text and stores it in the database associated with the memoryId.
   * If an embedding already exists but was generated with a different model, it warns and replaces it.
   */
  async generateAndStore(memoryId: string, text: string): Promise<void> {
    await this.initialize();
    try {
      // 1. Check existing embedding
      const existing = this.store.getEmbedding(memoryId);
      if (existing) {
        if (existing.model === this.provider.model) {
          // Already have an up-to-date embedding, no need to regenerate unless explicitly requested
          return;
        } else {
          logger.warn(`Memory ${memoryId} has an embedding from model '${existing.model}'. Replacing with current model '${this.provider.model}'.`);
        }
      }

      // 2. Generate vector
      const vector = await this.provider.embed(text);

      // 3. Store vector
      this.store.upsertEmbedding({
        memoryId,
        vector,
        model: this.provider.model,
        dimensions: this.provider.dimensions,
        createdAt: Date.now()
      });
      
      logger.debug(`Stored embedding for memory ${memoryId}`);
    } catch (error: any) {
      if (error instanceof EmbeddingError) {
        throw error;
      }
      throw new EmbeddingError(`Failed to generate and store embedding for memory ${memoryId}: ${error.message}`, 'GENERATE_AND_STORE_FAILED', error);
    }
  }

  /**
   * Generates and stores embeddings for multiple memories in batch.
   */
  async generateAndStoreMany(items: { memoryId: string; text: string }[]): Promise<void> {
    if (items.length === 0) return;
    await this.initialize();

    try {
      // Extract texts to embed
      const texts = items.map(item => item.text);
      const vectors = await this.provider.embedMany(texts);

      // Store all vectors
      const now = Date.now();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const vector = vectors[i];
        
        if (vector) { // Type check just in case
          this.store.upsertEmbedding({
            memoryId: item!.memoryId,
            vector,
            model: this.provider.model,
            dimensions: this.provider.dimensions,
            createdAt: now
          });
        }
      }
      logger.debug(`Batch stored embeddings for ${items.length} memories`);
    } catch (error: any) {
      if (error instanceof EmbeddingError) {
        throw error;
      }
      throw new EmbeddingError(`Failed to batch generate and store embeddings: ${error.message}`, 'BATCH_GENERATE_FAILED', error);
    }
  }

  /**
   * Retrieves an embedding from the store.
   */
  getVector(memoryId: string): number[] | null {
    const embedding = this.store.getEmbedding(memoryId);
    if (!embedding) return null;

    // Optional: Warn if we are retrieving a vector that doesn't match the current provider's dimensions
    if (embedding.dimensions !== this.provider.dimensions) {
      logger.warn(`Retrieving vector for memory ${memoryId} with ${embedding.dimensions} dims, but current provider expects ${this.provider.dimensions} dims.`);
    }

    return embedding.vector;
  }

  /**
   * Deletes an embedding.
   */
  deleteVector(memoryId: string): boolean {
    return this.store.deleteEmbedding(memoryId);
  }
}
