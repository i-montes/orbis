import { Database } from 'bun:sqlite';
import { DatabaseError, generateId, type RelationType, type MemoryEdge } from '@orbis/shared';

export class GraphManager {
  constructor(private db: Database) {}

  /**
   * Adds an edge (relationship) between two memories.
   */
  addEdge(sourceId: string, targetId: string, type: RelationType = 'related_to', weight: number = 1.0): void {
    const stmt = this.db.prepare(`
      INSERT INTO edges (id, source_id, target_id, relation_type, weight, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        generateId(),
        sourceId,
        targetId,
        type,
        weight,
        Date.now()
      );
    } catch (error) {
      throw new DatabaseError(`Failed to add edge from ${sourceId} to ${targetId}`, 'ADD_EDGE_FAILED', error);
    }
  }

  /**
   * Retrieves all edges where any of the provided IDs is a source or target.
   */
  getEdgesForMemories(ids: string[]): MemoryEdge[] {
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT * FROM edges 
      WHERE source_id IN (${placeholders}) 
         OR target_id IN (${placeholders})
    `);
    
    try {
      const rows = stmt.all(...ids, ...ids) as any[];
      return rows.map(row => ({
        id: row.id,
        sourceId: row.source_id,
        targetId: row.target_id,
        relationType: row.relation_type,
        weight: row.weight,
        createdAt: row.created_at
      }));
    } catch (error) {
      throw new DatabaseError('Failed to get edges for memories', 'GET_EDGES_FAILED', error);
    }
  }

  /**
   * Counts the total number of edges in the graph.
   */
  countEdges(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM edges');
    
    try {
      const result = stmt.get() as { count: number };
      return result.count;
    } catch (error) {
      throw new DatabaseError('Failed to count edges', 'COUNT_EDGES_FAILED', error);
    }
  }
}
