import { embed, embedMany } from 'ai';
import { createLogger } from '../logger/logger.js';

const logger = createLogger('shared:ai');

/**
 * Global configuration options for the AI SDK wrappers
 */
export interface AISDKConfig {
  maxRetries?: number;
  abortSignal?: AbortSignal;
}

/**
 * Returns a wrapped instance of AI SDK functions with centralized configuration.
 * This ensures all modules use the same retry and logging policies.
 */
export function createAISDK(globalConfig?: AISDKConfig) {
  const defaultRetries = globalConfig?.maxRetries ?? 2;

  return {
    embed: async (options: Parameters<typeof embed>[0]) => {
      try {
        return await embed({
          maxRetries: defaultRetries,
          abortSignal: globalConfig?.abortSignal,
          ...options,
        });
      } catch (error: any) {
        logger.error(`AI SDK embed error: ${error.message}`);
        throw error;
      }
    },
    
    embedMany: async (options: Parameters<typeof embedMany>[0]) => {
      try {
        return await embedMany({
          maxRetries: defaultRetries,
          abortSignal: globalConfig?.abortSignal,
          ...options,
        });
      } catch (error: any) {
        logger.error(`AI SDK embedMany error: ${error.message}`);
        throw error;
      }
    },

    // Additional generic methods like generateText could be added here later
    // for use by agents in Phase 5
  };
}
