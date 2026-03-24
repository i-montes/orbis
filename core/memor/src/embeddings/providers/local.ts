import { EmbeddingError, createLogger } from '@orbis/shared';
import { pipeline, env } from '@huggingface/transformers';
import type { OrbisEmbeddingProvider } from '../provider.js';

const logger = createLogger('memor:embedding:local');

// Disable remote caching checks if local model is already present, ensures true offline capability
env.allowLocalModels = true;
env.useBrowserCache = false;

export class LocalEmbeddingProvider implements OrbisEmbeddingProvider {
  public readonly model: string = 'Xenova/all-MiniLM-L6-v2';
  public readonly dimensions: number = 384;
  
  private extractorPromise: Promise<any> | null = null;

  constructor() {}

  async initialize(): Promise<void> {
    await this.getExtractor();
  }

  /**
   * Lazy loads the model from HuggingFace Hub.
   * Caches the promise to avoid concurrent initializations.
   */
  private async getExtractor() {
    if (!this.extractorPromise) {
      logger.info(`Initializing local embedding model (${this.model}). This may take a while the first time as it downloads to ~/.cache/huggingface...`);
      this.extractorPromise = pipeline('feature-extraction', this.model).catch(err => {
        this.extractorPromise = null;
        throw new EmbeddingError(`Failed to load local model ${this.model}: ${err.message}`, 'LOCAL_MODEL_LOAD_ERROR', err);
      });
    }
    return this.extractorPromise;
  }

  async embed(text: string): Promise<number[]> {
    try {
      const extractor = await this.getExtractor();
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      
      // Output is a Tensor. We convert it to a standard JS array.
      const embedding = Array.from(output.data) as number[];

      if (embedding.length !== this.dimensions) {
        throw new EmbeddingError(`Local model returned ${embedding.length} dims, expected ${this.dimensions}`, 'DIMENSION_MISMATCH');
      }

      return embedding;
    } catch (error: any) {
      if (error instanceof EmbeddingError) throw error;
      throw new EmbeddingError(`Local embed error: ${error.message}`, 'LOCAL_EMBED_ERROR', error);
    }
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    // Transformers.js pipeline supports batching directly
    try {
      const extractor = await this.getExtractor();
      const output = await extractor(texts, { pooling: 'mean', normalize: true });
      
      // The output tensor for batches has shape [batch_size, dimensions]
      const batchSize = texts.length;
      const flatData = output.data;
      const result: number[][] = [];

      for (let i = 0; i < batchSize; i++) {
        const start = i * this.dimensions;
        const end = start + this.dimensions;
        result.push(Array.from(flatData.slice(start, end)) as number[]);
      }

      return result;
    } catch (error: any) {
      if (error instanceof EmbeddingError) throw error;
      throw new EmbeddingError(`Local embedMany error: ${error.message}`, 'LOCAL_EMBED_ERROR', error);
    }
  }
}
