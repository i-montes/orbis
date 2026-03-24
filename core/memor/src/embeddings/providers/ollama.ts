import { createAISDK, EmbeddingError, createLogger, type EmbeddingProviderConfig } from '@orbis/shared';
import { createOllama } from 'ollama-ai-provider';
import type { OrbisEmbeddingProvider } from '../provider.js';

const logger = createLogger('memor:embedding:ollama');

export class OllamaEmbeddingProvider implements OrbisEmbeddingProvider {
  public readonly model: string;
  public readonly dimensions: number;
  private ai: ReturnType<typeof createAISDK>;
  private providerModel: any;

  constructor(config: EmbeddingProviderConfig) {
    this.model = config.model;
    this.dimensions = config.dimensions;
    this.ai = createAISDK();

    const ollama = createOllama({
      baseURL: config.baseUrl || 'http://localhost:11434',
    });
    this.providerModel = ollama.textEmbeddingModel(this.model);
  }

  async embed(text: string): Promise<number[]> {
    try {
      const { embedding } = await this.ai.embed({
        model: this.providerModel,
        value: text,
      });

      if (embedding.length !== this.dimensions) {
        throw new EmbeddingError(
          `Ollama returned ${embedding.length} dimensions, but ${this.dimensions} were configured for model '${this.model}'.`,
          'DIMENSION_MISMATCH'
        );
      }
      return embedding;
    } catch (error: any) {
      this.translateError(error);
      throw error; // Fallback if translation didn't throw
    }
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    try {
      const { embeddings } = await this.ai.embedMany({
        model: this.providerModel,
        values: texts,
      });

      for (const embedding of embeddings) {
        if (embedding.length !== this.dimensions) {
           throw new EmbeddingError(
            `Ollama returned ${embedding.length} dimensions, but ${this.dimensions} were configured.`,
            'DIMENSION_MISMATCH'
          );
        }
      }
      return embeddings;
    } catch (error: any) {
      this.translateError(error);
      throw error;
    }
  }

  private translateError(error: any): never {
    if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
      throw new EmbeddingError(`Ollama no está corriendo. Ejecuta 'ollama serve' para iniciarlo.`, 'CONNECTION_REFUSED', error);
    }
    if (error.message?.includes('not found') || error.status === 404) {
      throw new EmbeddingError(`El modelo '${this.model}' no está disponible. Ejecuta 'ollama pull ${this.model}' para descargarlo.`, 'MODEL_NOT_FOUND', error);
    }
    throw new EmbeddingError(`Ollama embed error: ${error.message}`, 'OLLAMA_ERROR', error);
  }
}
