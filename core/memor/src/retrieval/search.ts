import { normalizeText, type SearchResult } from '@orbis/shared';
import { type MemorStore } from '../store/store.js';
import { type VectorIndex } from '../vectors/index.js';
import { type EmbeddingManager } from '../embeddings/manager.js';
import { rerank } from './reranker.js';

export interface SearchOptions {
  topK: number;
  lambda?: number;
  candidateMultiplier?: number;
}

/**
 * Main retrieval function.
 * Orchestrates embedding generation, vector search, and reranking with recency.
 */
export async function search(
  query: string,
  store: MemorStore,
  vectorIndex: VectorIndex,
  embeddingManager: EmbeddingManager,
  options: SearchOptions
): Promise<SearchResult[]> {
  // 1. Normalize query
  const cleanQuery = normalizeText(query);

  // 2. Generate temporary query vector
  const queryVector = await embeddingManager.generateQueryVector(cleanQuery);

  // 3. Search more candidates than requested for reranking
  const multiplier = options.candidateMultiplier || 3;
  const candidateCount = options.topK * multiplier;
  const vectorResults = vectorIndex.search(queryVector, candidateCount);

  if (vectorResults.length === 0) return [];

  // 4. Load full memories for candidates
  const memoryIds = vectorResults.map(r => r.memoryId);
  const memories = store.getMemoriesByIds(memoryIds);
  
  // Create a map for quick access and distance association
  const memoryMap = new Map(memories.map(m => [m.id, m]));
  
  // Filter and format candidates for reranker
  const candidates = vectorResults
    .map(vr => ({
      memoryId: vr.memoryId,
      distance: vr.distance,
      memory: memoryMap.get(vr.memoryId)!
    }))
    .filter(c => !!c.memory);

  // 5. Rerank using recency_lambda
  const results = rerank(candidates, {
    lambda: options.lambda ?? 0.1, // Default from config strategy
    topK: options.topK
  });

  // 6. Update access stats for final results (background async not awaited for speed)
  for (const result of results) {
    store.updateAccessStats(result.memory.id);
  }

  return results;
}
