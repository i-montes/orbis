import { z } from 'zod';

export const embeddingProviderSchema = z.object({
  type: z.enum(['ollama', 'openai']),
  model: z.string(),
  dimensions: z.number().int().min(64),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
});

export type EmbeddingProviderConfig = z.infer<typeof embeddingProviderSchema>;
export type EmbeddingProvidersMap = Record<string, EmbeddingProviderConfig>;

/**
 * Zod schema for Orbis configuration.
 * This should match orbis.config.schema.json.
 */
export const configSchema = z.object({
  $schema: z.string().optional(),
  version: z.string().default('0.1.0'),
  name: z.string().default('orbis'),

  data: z.object({
    path: z.string().default('./data'),
  }).default({ path: './data' }),

  memor: z.object({
    enabled: z.boolean().default(true),
    database: z.string().default('memor.db'),
    recency_lambda: z.number().min(0).max(1).default(0.1),
    autoEdgeThreshold: z.number().min(0).max(1).default(0.85),
    embedding: z.object({
      default: z.string().default('ollama-qwen'),
      providers: z.record(z.string(), embeddingProviderSchema).optional().default({
        'ollama-qwen': {
          type: 'ollama' as const,
          model: 'qwen3-embedding:0.6b',
          dimensions: 1024,
          baseUrl: 'http://localhost:11434'
        },
        'openai-small': {
          type: 'openai' as const,
          model: 'text-embedding-3-small',
          dimensions: 1536
        }
      }),
    }).default({
      default: 'ollama-qwen',
      providers: {
        'ollama-qwen': {
          type: 'ollama' as const,
          model: 'qwen3-embedding:0.6b',
          dimensions: 1024,
          baseUrl: 'http://localhost:11434'
        },
        'openai-small': {
          type: 'openai' as const,
          model: 'text-embedding-3-small',
          dimensions: 1536
        }
      }
    }),
    hnsw: z.object({
      m: z.number().int().min(2).default(16),
      ef_construction: z.number().int().min(16).default(200),
    }).default({ m: 16, ef_construction: 200 }),
  }).default({
    enabled: true,
    database: 'memor.db',
    recency_lambda: 0.1,
    autoEdgeThreshold: 0.85,
    embedding: {
      default: 'ollama-qwen',
      providers: {
        'ollama-qwen': {
          type: 'ollama' as const,
          model: 'qwen3-embedding:0.6b',
          dimensions: 1024,
          baseUrl: 'http://localhost:11434'
        },
        'openai-small': {
          type: 'openai' as const,
          model: 'text-embedding-3-small',
          dimensions: 1536
        }
      }
    },
    hnsw: { m: 16, ef_construction: 200 }
  }),

  socket: z.object({
    enabled: z.boolean().default(true),
    port: z.number().int().min(1024).max(65535).default(3001),
    host: z.string().default('localhost'),
  }).default({
    enabled: true,
    port: 3001,
    host: 'localhost',
  }),

  mcp: z.object({
    enabled: z.boolean().default(true),
    transport: z.enum(['stdio', 'http']).default('stdio'),
  }).default({
    enabled: true,
    transport: 'stdio',
  }),

  logger: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['pretty', 'json']).default('pretty'),
  }).default({
    level: 'info',
    format: 'pretty',
  }),
});

/**
 * Inferred type from the Zod schema
 */
export type OrbisConfig = z.infer<typeof configSchema>;
