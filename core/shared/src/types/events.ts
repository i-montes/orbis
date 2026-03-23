import type { Memory, SearchResult } from './memory.js';
import type { OrbisError } from '../errors/base.js';

/**
 * Map of event names to their respective payloads
 */
export interface OrbisEvents {
  'memory:stored': Memory;
  'memory:retrieved': SearchResult[];
  'memory:forgotten': { memoryId: string };
  'system:ready': { module: string };
  'system:error': { module: string; error: OrbisError };
}

/**
 * Union of all available event names
 */
export type OrbisEventName = keyof OrbisEvents;
