import { Database } from 'bun:sqlite';
import { DatabaseError } from '@orbis/shared';
import { normalizeVector } from './similarity.js';

export interface VectorSearchResult {
  memoryId: string;
  distance: number;
}

export class VectorIndex {
  constructor(private db: Database) {}

  /**
   * Inserts or replaces a vector in the virtual table.
   * Vectors are normalized to unit length before insertion.
   */
  insert(memoryId: string, vector: number[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memory_vectors (memory_id, embedding)
      VALUES (?, ?)
    `);

    try {
      const normalized = normalizeVector(vector);
      // sqlite-vec expects Float32Array for FLOAT[N] columns
      const floatArray = new Float32Array(normalized);
      stmt.run(memoryId, floatArray);
    } catch (error) {
      throw new DatabaseError(`Failed to insert vector for memory ${memoryId}`, 'VECTOR_INSERT_FAILED', error);
    }
  }

  /**
   * Deletes a vector from the index.
   */
  delete(memoryId: string): void {
    const stmt = this.db.prepare('DELETE FROM memory_vectors WHERE memory_id = ?');
    
    try {
      stmt.run(memoryId);
    } catch (error) {
      throw new DatabaseError(`Failed to delete vector for memory ${memoryId}`, 'VECTOR_DELETE_FAILED', error);
    }
  }

  /**
   * Performs a nearest neighbor search.
   */
  search(queryVector: number[], limit: number): VectorSearchResult[] {
    const stmt = this.db.prepare(`
      SELECT memory_id, distance
      FROM memory_vectors
      WHERE embedding MATCH ?
      ORDER BY distance
      LIMIT ?
    `);

    try {
      const floatArray = new Float32Array(queryVector);
      const rows = stmt.all(floatArray, limit) as any[];
      
      return rows.map(row => ({
        memoryId: row.memory_id,
        distance: row.distance
      }));
    } catch (error) {
      throw new DatabaseError('Vector search failed', 'VECTOR_SEARCH_FAILED', error);
    }
  }

  /**
   * Returns the number of indexed vectors.
   */
  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM memory_vectors');
    
    try {
      const result = stmt.get() as { count: number };
      return result.count;
    } catch (error) {
      throw new DatabaseError('Failed to count vectors', 'VECTOR_COUNT_FAILED', error);
    }
  }
}
