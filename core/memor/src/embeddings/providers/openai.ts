import { createAISDK, EmbeddingError, createLogger, type EmbeddingProviderConfig } from '@orbis/shared';
import { createOpenAI } from '@ai-sdk/openai';
import type { OrbisEmbeddingProvider } from '../provider.js';

const logger = createLogger('memor:embedding:openai');

export class OpenAIEmbeddingProvider implements OrbisEmbeddingProvider {
  public readonly model: string;
  public readonly dimensions: number;
  private ai: ReturnType<typeof createAISDK>;
  private providerModel: any;
  private config: EmbeddingProviderConfig;

  constructor(config: EmbeddingProviderConfig) {
    this.model = config.model;
    this.dimensions = config.dimensions;
    this.ai = createAISDK();
    this.config = config;
  }

  async initialize(): Promise<void> {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new EmbeddingError(
        "No se encontró API key para OpenAI. Declara 'apiKey' en el config del provider o define OPENAI_API_KEY en .env",
        'MISSING_API_KEY'
      );
    }

    const openai = createOpenAI({ apiKey });
    this.providerModel = openai.textEmbeddingModel(this.model);
  }

  async embed(text: string): Promise<number[]> {
    if (!this.providerModel) await this.initialize();
    try {
      const { embedding } = await this.ai.embed({
        model: this.providerModel,
        value: text,
      });

      if (embedding.length !== this.dimensions) {
        throw new EmbeddingError(`OpenAI returned ${embedding.length} dimensions, expected ${this.dimensions}.`, 'DIMENSION_MISMATCH');
      }
      return embedding;
    } catch (error: any) {
      this.translateError(error);
      throw error;
    }
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    if (!this.providerModel) await this.initialize();
    try {
      const { embeddings } = await this.ai.embedMany({
        model: this.providerModel,
        values: texts,
      });

      for (const embedding of embeddings) {
        if (embedding.length !== this.dimensions) {
           throw new EmbeddingError(`OpenAI returned ${embedding.length} dimensions, expected ${this.dimensions}.`, 'DIMENSION_MISMATCH');
        }
      }
      return embeddings;
    } catch (error: any) {
      this.translateError(error);
      throw error;
    }
  }

  private translateError(error: any): never {
    if (error.statusCode === 401 || error.message?.includes('401')) {
      throw new EmbeddingError(`La API key de OpenAI es inválida o ha expirado.`, 'UNAUTHORIZED', error);
    }
    if (error.statusCode === 429 || error.message?.includes('429')) {
      throw new EmbeddingError(`Rate limit de OpenAI alcanzado.`, 'RATE_LIMIT', error);
    }
    throw new EmbeddingError(`OpenAI embed error: ${error.message}`, 'OPENAI_ERROR', error);
  }
}
