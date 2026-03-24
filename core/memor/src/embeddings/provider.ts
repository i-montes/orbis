import { getConfig, ConfigError } from '@orbis/shared';

// We will import the actual classes after they are defined to use in the factory.
import { LocalEmbeddingProvider } from './providers/local.js';
import { OllamaEmbeddingProvider } from './providers/ollama.js';
import { OpenAIEmbeddingProvider } from './providers/openai.js';

export interface OrbisEmbeddingProvider {
  /**
   * The name of the model being used.
   */
  readonly model: string;
  
  /**
   * The expected number of dimensions for the generated vectors.
   */
  readonly dimensions: number;

  /**
   * (Optional) Initializes the provider, e.g. checking if it's running, pulling models, etc.
   */
  initialize?(): Promise<void>;

  /**
   * Generates a vector embedding for a single string.
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generates vector embeddings for an array of strings in batch.
   */
  embedMany(texts: string[]): Promise<number[][]>;
}

/**
 * Creates and returns the appropriate embedding provider based on the configuration.
 */
export function createEmbeddingProvider(alias?: string): OrbisEmbeddingProvider {
  const config = getConfig();
  const embeddingConfig = config.memor?.embedding;
  const providersMap = embeddingConfig?.providers || {};

  // Helper to instantiate based on config
  const instantiate = (providerConfig: any) => {
    switch (providerConfig.type) {
      case 'ollama':
        return new OllamaEmbeddingProvider(providerConfig);
      case 'openai':
        return new OpenAIEmbeddingProvider(providerConfig);
      default:
        throw new ConfigError(`Unsupported embedding provider type: ${providerConfig.type}`);
    }
  };

  // 1. Explicit alias requested
  if (alias) {
    const providerConfig = providersMap[alias];
    if (!providerConfig) {
      throw new ConfigError(`Embedding provider alias '${alias}' not found in configuration.`);
    }
    return instantiate(providerConfig);
  }

  // 2. No alias requested, check if we need to fallback
  const hasProviders = Object.keys(providersMap).length > 0;
  if (!hasProviders) {
    return new LocalEmbeddingProvider();
  }

  // 3. Resolve default
  const targetAlias = embeddingConfig?.default;
  if (!targetAlias) {
    throw new ConfigError('No default embedding provider is defined and no alias was provided.');
  }

  const providerConfig = providersMap[targetAlias];
  if (!providerConfig) {
    throw new ConfigError(`Embedding provider alias '${targetAlias}' not found in configuration.`);
  }

  return instantiate(providerConfig);
}
