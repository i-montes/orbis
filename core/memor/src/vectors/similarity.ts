/**
 * Normalizes a vector to unit length (L2 norm = 1).
 */
export function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  
  if (norm === 0) {
    return vector;
  }
  
  return vector.map(val => val / norm);
}

/**
 * Converts L2 distance (squared) to Cosine Similarity.
 * 
 * Formula: cosine_similarity = 1 - (l2_distance_squared / 2)
 * This assumes the vectors are already normalized.
 * 
 * Note: sqlite-vec returns the squared L2 distance.
 */
export function l2ToCosineSimilarity(distanceSquared: number): number {
  return 1 - (distanceSquared / 2);
}
