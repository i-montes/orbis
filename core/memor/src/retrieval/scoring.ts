import { daysSince } from '@orbis/shared';
import { l2ToCosineSimilarity } from '../vectors/similarity.js';

export interface ScoredResult {
  memoryId: string;
  semanticScore: number;
  recencyScore: number;
  combinedScore: number;
}

/**
 * Converts L2 distance to a semantic score between 0 and 1.
 */
export function calculateSemanticScore(distanceSquared: number): number {
  const similarity = l2ToCosineSimilarity(distanceSquared);
  return Math.max(0, similarity);
}

/**
 * Calculates the recency decay factor.
 * Formula: e^(-lambda * days)
 */
export function calculateRecencyScore(createdAt: number, lambda: number): number {
  if (lambda === 0) return 1.0;
  
  const days = daysSince(createdAt);
  return Math.exp(-lambda * days);
}

/**
 * Multiplies scores to get the final ranking metric.
 */
export function calculateCombinedScore(semantic: number, recency: number): number {
  return semantic * recency;
}

/**
 * Sorts results by combined score descending and limits to topK.
 */
export function rankResults(results: ScoredResult[], topK: number): ScoredResult[] {
  return [...results]
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, topK);
}
