import { EmbeddingError, createLogger, type EmbeddingProviderConfig } from '@orbis/shared';
import type { OrbisEmbeddingProvider } from '../provider.js';
import { spawn } from 'child_process';

const logger = createLogger('memor:embedding:ollama');

export class OllamaEmbeddingProvider implements OrbisEmbeddingProvider {
  public readonly model: string;
  public readonly dimensions: number;
  private baseUrl: string;

  constructor(config: EmbeddingProviderConfig) {
    this.model = config.model;
    this.dimensions = config.dimensions;
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
  }

  async initialize(): Promise<void> {
    await this.ensureOllamaRunning();
    await this.ensureModelExists();
  }

  private async ensureOllamaRunning(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (response.ok) return;
    } catch (e) {
      logger.info('Ollama no está corriendo. Intentando iniciar...');
      
      const proc = spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore'
      });
      proc.unref();

      for (let i = 0; i < 30; i++) {
        try {
          const res = await fetch(`${this.baseUrl}/api/tags`);
          if (res.ok) {
            logger.info('Ollama iniciado correctamente.');
            return;
          }
        } catch (err) {}
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      throw new EmbeddingError('No se pudo iniciar Ollama automáticamente. Por favor, ejecútalo manualmente.', 'AUTO_START_FAILED');
    }
  }

  private async ensureModelExists(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      const data = (await response.json()) as { models: { name: string }[] };
      const exists = data.models.some(m => m.name === this.model || m.name.startsWith(`${this.model}:`));

      if (!exists) {
        logger.info(`Modelo '${this.model}' no encontrado. Descargando...`);
        const pullRes = await fetch(`${this.baseUrl}/api/pull`, {
          method: 'POST',
          body: JSON.stringify({ name: this.model, stream: false })
        });

        if (!pullRes.ok) {
          throw new Error(`Error al descargar modelo: ${pullRes.statusText}`);
        }
        logger.info(`Modelo '${this.model}' descargado con éxito.`);
      }
    } catch (error: any) {
      throw new EmbeddingError(`Error al verificar/descargar el modelo '${this.model}': ${error.message}`, 'MODEL_SETUP_FAILED', error);
    }
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error((errorData as any).message || response.statusText);
      }

      const data = (await response.json()) as { embedding: number[] };
      const embedding = data.embedding;

      if (embedding.length !== this.dimensions) {
        throw new EmbeddingError(
          `Ollama returned ${embedding.length} dimensions, but ${this.dimensions} were configured for model '${this.model}'.`,
          'DIMENSION_MISMATCH'
        );
      }
      return embedding;
    } catch (error: any) {
      this.translateError(error);
      throw error;
    }
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    // Ollama's /api/embeddings does not support batching natively in a single call with an array of prompts
    // in the same way as OpenAI, but we can parallelize.
    try {
      const results = await Promise.all(texts.map(text => this.embed(text)));
      return results;
    } catch (error: any) {
      this.translateError(error);
      throw error;
    }
  }

  private translateError(error: any): never {
    if (error instanceof EmbeddingError) throw error;
    
    if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
      throw new EmbeddingError(`Ollama no está corriendo.`, 'CONNECTION_REFUSED', error);
    }
    throw new EmbeddingError(`Ollama error: ${error.message}`, 'OLLAMA_ERROR', error);
  }
}
