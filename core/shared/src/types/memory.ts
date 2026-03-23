/**
 * Supported types of relations between memories
 */
export type RelationType = 'related_to' | 'contradicts' | 'elaborates' | 'causes' | 'precedes';

/**
 * Basic memory unit
 */
export interface Memory {
  id: string;
  content: string;
  summary?: string;
  createdAt: number; // Unix timestamp in milliseconds
  lastAccessedAt?: number;
  accessCount: number;
  source?: string;
  memoryType: 'EXPERIENCE' | 'DECISION' | 'FACT' | 'TASK' | 'WORLD';
  metadata?: Record<string, unknown>;
}

/**
 * Memory node including embedding vector
 */
export interface MemoryNode extends Memory {
  embedding?: number[]; // The vector itself
}

/**
 * Relationship between two memories
 */
export interface MemoryEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  weight: number; // between 0.0 and 1.0
  createdAt: number;
}

/**
 * Embedding information stored in the vector store
 */
export interface EmbeddingVector {
  memoryId: string;
  vector: number[];
  model: string;
  dimensions: number;
  createdAt: number;
}

/**
 * Result returned by the retrieval system
 */
export interface SearchResult {
  memory: Memory;
  score: number; // final score after recency_lambda
  semanticScore: number; // pure vector similarity score
  recencyScore: number; // temporal decay factor applied
}
