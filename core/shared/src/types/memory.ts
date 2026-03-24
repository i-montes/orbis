/**
 * Supported types of relations between memories
 */
export type RelationType = 'related_to' | 'contradicts' | 'elaborates' | 'causes' | 'precedes';

/**
 * Valid sources for a memory
 */
export type MemorySource = 'AGENT' | 'SYSTEM' | 'USER' | 'GROUP';

/**
 * Categorization of memories
 */
export type MemoryType = 'EXPERIENCE' | 'DECISION' | 'FACT' | 'TASK' | 'WORLD';

/**
 * Basic memory unit
 */
export interface Memory {
  id: string;
  content: string;
  summary?: string;
  source: MemorySource;
  memoryType: MemoryType;
  createdAt: number; // Unix timestamp in milliseconds
  updatedAt: number; // Unix timestamp in milliseconds
  lastAccessedAt?: number;
  accessCount: number;
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
