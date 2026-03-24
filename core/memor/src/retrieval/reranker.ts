import { type Memory, type SearchResult } from '@orbis/shared';
import { calculateSemanticScore, calculateRecencyScore, calculateCombinedScore } from './scoring.js';

export interface CandidateResult {
  memoryId: string;
  distance: number;
  memory: Memory;
}

export interface RerankOptions {
  lambda: number;
  topK: number;
}

/**
 * Reranks candidates based on semantic similarity and temporal recency.
 */
export function rerank(candidates: CandidateResult[], options: RerankOptions): SearchResult[] {
  const scored = candidates.map(candidate => {
    const semantic = calculateSemanticScore(candidate.distance);
    const recency = calculateRecencyScore(candidate.memory.createdAt, options.lambda);
    const combined = calculateCombinedScore(semantic, recency);

    return {
      memory: candidate.memory,
      semanticScore: semantic,
      recencyScore: recency,
      score: combined
    };
  });

  // Sort by combined score descending and limit to topK
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, options.topK);
}
