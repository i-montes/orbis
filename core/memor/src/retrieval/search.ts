import { normalizeText, type SearchResult } from '@orbis/shared';
import { type MemorStore } from '../store/store.js';
import { type VectorIndex } from '../vectors/index.js';
import { type EmbeddingManager } from '../embeddings/manager.js';
import { rerank, type CandidateResult } from './reranker.js';
import { calculateSemanticScore } from './scoring.js';

export interface SearchOptions {
  topK: number;
  lambda?: number;
  candidateMultiplier?: number;
  expandGraph?: boolean;
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
  const initialMemoryIds = vectorResults.map(r => r.memoryId);
  const initialMemories = store.getMemoriesByIds(initialMemoryIds);
  const memoryMap = new Map(initialMemories.map(m => [m.id, m]));
  
  // Format initial candidates
  let candidates: CandidateResult[] = vectorResults
    .map(vr => ({
      memoryId: vr.memoryId,
      distance: vr.distance,
      memory: memoryMap.get(vr.memoryId)!
    }))
    .filter(c => !!c.memory);

  // 5. Optional Graph Expansion
  if (options.expandGraph) {
    const edges = store.getEdgesForMemories(initialMemoryIds);
    const candidateScores = new Map(candidates.map(c => [c.memoryId, calculateSemanticScore(c.distance!)]));
    const expandedIds = new Set<string>();
    const neighborsToLoad: { id: string, score: number }[] = [];

    for (const edge of edges) {
      // Find which side is the neighbor
      const isSourceCandidate = candidateScores.has(edge.sourceId);
      const parentId = isSourceCandidate ? edge.sourceId : edge.targetId;
      const neighborId = isSourceCandidate ? edge.targetId : edge.sourceId;

      // Skip if neighbor is already a direct semantic candidate (usually better score there)
      if (candidateScores.has(neighborId)) continue;

      const parentScore = candidateScores.get(parentId)!;
      const inheritedScore = parentScore * edge.weight;

      // Keep only the best inherited score if found via multiple paths
      const existing = expandedIds.has(neighborId) ? neighborsToLoad.find(n => n.id === neighborId) : null;
      if (!existing) {
        expandedIds.add(neighborId);
        neighborsToLoad.push({ id: neighborId, score: inheritedScore });
      } else if (inheritedScore > existing.score) {
        existing.score = inheritedScore;
      }
    }

    if (neighborsToLoad.length > 0) {
      const neighborMemories = store.getMemoriesByIds(neighborsToLoad.map(n => n.id));
      const neighborMemMap = new Map(neighborMemories.map(m => [m.id, m]));

      for (const n of neighborsToLoad) {
        const mem = neighborMemMap.get(n.id);
        if (mem) {
          candidates.push({
            memoryId: n.id,
            memory: mem,
            semanticScore: n.score
          });
        }
      }
    }
  }

  // 6. Rerank using recency_lambda
  const results = rerank(candidates, {
    lambda: options.lambda ?? 0.1,
    topK: options.topK
  });

  // 7. Update access stats for final results
  for (const result of results) {
    store.updateAccessStats(result.memory.id);
  }

  return results;
}
