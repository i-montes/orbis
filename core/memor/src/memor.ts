import { getConfig, type Memory, createLogger, type RelationType } from '@orbis/shared';
import { MemorStore } from './store/store.js';
import { EmbeddingManager } from './embeddings/manager.js';
import { type VectorIndex } from './vectors/index.js';
import { GraphManager } from './graph/manager.js';
import { search, type SearchOptions } from './retrieval/search.js';
import { calculateSemanticScore } from './retrieval/scoring.js';

const logger = createLogger('memor:core');

export class Memor {
  private store: MemorStore;
  private manager: EmbeddingManager;
  private graph: GraphManager;

  constructor(customDbPath?: string) {
    this.store = new MemorStore(customDbPath);
    this.manager = new EmbeddingManager(this.store);
    this.graph = new GraphManager(this.store.db);
  }

  /**
   * Adds a new memory, generates its embedding, and automatically creates
   * edges to semantically similar existing memories.
   */
  async addMemory(memoryInput: Omit<Memory, 'accessCount' | 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Memory> {
    const config = getConfig();
    
    // 1. Insert into base table
    const memory = this.store.insertMemory(memoryInput);
    
    // 2. Generate and store embedding (also syncs with VectorIndex)
    await this.manager.generateAndStore(memory.id, memory.content);
    
    // 3. Auto-linking logic
    try {
      const embedding = this.store.getEmbedding(memory.id);
      if (embedding) {
        // Search for nearest neighbors
        const N = 5;
        const neighbors = this.store.vectorIndex.search(embedding.vector, N + 1); // +1 because it will find itself
        
        const threshold = config.memor.autoEdgeThreshold ?? 0.85;
        
        let edgesCreated = 0;
        for (const neighbor of neighbors) {
          if (neighbor.memoryId === memory.id) continue;
          
          const semanticScore = calculateSemanticScore(neighbor.distance);
          if (semanticScore >= threshold) {
            this.graph.addEdge(memory.id, neighbor.memoryId, 'related_to', semanticScore);
            edgesCreated++;
          }
        }
        
        if (edgesCreated > 0) {
          logger.info(`Auto-linked memory ${memory.id} to ${edgesCreated} existing memories`);
        }
      }
    } catch (error: any) {
      logger.error(`Error during auto-linking for memory ${memory.id}: ${error.message}`);
      // We don't throw here to ensure the memory insertion itself is considered successful
    }

    return memory;
  }

  /**
   * Performs a vector search with recency decay and graph expansion.
   */
  async search(query: string, options: SearchOptions): ReturnType<typeof search> {
    return search(query, this.store, this.store.vectorIndex, this.manager, this.graph, options);
  }

  /**
   * Adds an edge (relationship) between two memories.
   */
  addEdge(sourceId: string, targetId: string, type: RelationType = 'related_to', weight: number = 1.0): void {
    this.graph.addEdge(sourceId, targetId, type, weight);
  }

  /**
   * Clears all data from the memory store.
   */
  reset(): void {
    this.store.reset();
  }

  /**
   * Returns current statistics of the memory store.
   */
  getStats() {
    return {
      memories: this.store.countMemories(),
      edges: this.graph.countEdges(),
      sizeBytes: this.store.getDatabaseSize()
    };
  }

  /**
   * Closes the underlying database connection.
   */
  close(): void {
    this.store.close();
  }
}
