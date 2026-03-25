import { Database } from 'bun:sqlite';
import * as sqliteVec from 'sqlite-vec';
import { runMigrations } from './migrations/index.js';
import { createLogger, DatabaseError, getConfig, generateId, findProjectRoot, type Memory, type EmbeddingVector, type RelationType, type MemoryEdge } from '@orbis/shared';
import { mkdirSync, statSync } from 'fs';
import { dirname, join, isAbsolute } from 'path';
import { VectorIndex } from '../vectors/index.js';

const logger = createLogger('memor:store');

export class MemorStore {
  public db: Database;
  public dbPath: string = '';
  public vectorIndex: VectorIndex;

  constructor(customPath?: string) {
    try {
      if (customPath) {
        this.dbPath = customPath;
      } else {
        const config = getConfig();
        const projectRoot = findProjectRoot();
        const rawPath = join(config.data.path, config.memor.database);
        this.dbPath = isAbsolute(rawPath) ? rawPath : join(projectRoot, rawPath);
      }

      mkdirSync(dirname(this.dbPath), { recursive: true });

      this.db = new Database(this.dbPath);
      
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA foreign_keys = ON;');
      this.db.exec('PRAGMA synchronous = NORMAL;');

      // Load sqlite-vec extension
      sqliteVec.load(this.db);

      logger.info(`Opened database at ${this.dbPath}`);
      
      runMigrations(this.db);

      this.vectorIndex = new VectorIndex(this.db);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to initialize database at ${this.dbPath || 'unknown path'}`, 'INIT_FAILED', error);
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      logger.info('Database connection closed');
    }
  }

  /**
   * Inserts a new memory into the store.
   * Generates an ID if none is provided.
   */
  insertMemory(memoryInput: Omit<Memory, 'accessCount' | 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Memory {
    const now = Date.now();
    const memory: Memory = {
      ...memoryInput,
      id: memoryInput.id || generateId(),
      accessCount: 0,
      createdAt: now,
      updatedAt: now
    };

    const stmt = this.db.prepare(`
      INSERT INTO memories (
        id, content, summary, source, memory_type, metadata, 
        access_count, last_accessed_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        memory.id,
        memory.content,
        memory.summary || null,
        memory.source,
        memory.memoryType,
        memory.metadata ? JSON.stringify(memory.metadata) : null,
        memory.accessCount,
        memory.lastAccessedAt || null,
        memory.createdAt,
        memory.updatedAt
      );
      return memory;
    } catch (error) {
      throw new DatabaseError(`Failed to insert memory ${memory.id}`, 'INSERT_MEMORY_FAILED', error);
    }
  }

  getMemoryById(id: string): Memory | null {
    const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
    
    try {
      const row = stmt.get(id) as any;
      if (!row) return null;

      return this.mapRowToMemory(row);
    } catch (error) {
      throw new DatabaseError(`Failed to get memory ${id}`, 'GET_MEMORY_FAILED', error);
    }
  }

  /**
   * Batch version of getMemoryById.
   * Returns memories in the order specified by the input IDs.
   */
  getMemoriesByIds(ids: string[]): Memory[] {
    if (ids.length === 0) return [];

    // Create placeholders (?, ?, ?)
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT * FROM memories WHERE id IN (${placeholders})`);
    
    try {
      const rows = stmt.all(...ids) as any[];
      const memoryMap = new Map(rows.map(row => [row.id, this.mapRowToMemory(row)]));
      
      // Return in original order, filtering missing ones
      return ids
        .map(id => memoryMap.get(id))
        .filter((m): m is Memory => !!m);
    } catch (error) {
      throw new DatabaseError('Failed to get memories in batch', 'GET_MEMORIES_BATCH_FAILED', error);
    }
  }

  /**
   * Updates last_accessed_at and increments access_count.
   * Does nothing if the ID doesn't exist.
   */
  updateAccessStats(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE memories
      SET access_count = access_count + 1,
          last_accessed_at = ?
      WHERE id = ?
    `);

    try {
      stmt.run(Date.now(), id);
    } catch (error) {
      throw new DatabaseError(`Failed to update access stats for memory ${id}`, 'UPDATE_STATS_FAILED', error);
    }
  }

  /**
   * Updates a memory's basic fields and its updated_at timestamp.
   */
  updateMemory(id: string, data: Partial<Pick<Memory, 'content' | 'summary' | 'source' | 'memoryType' | 'metadata'>>): Memory | null {
    const current = this.getMemoryById(id);
    if (!current) return null;

    const updated = {
      ...current,
      ...data,
      updatedAt: Date.now()
    };

    const stmt = this.db.prepare(`
      UPDATE memories
      SET content = ?, summary = ?, source = ?, memory_type = ?, metadata = ?, updated_at = ?
      WHERE id = ?
    `);

    try {
      stmt.run(
        updated.content,
        updated.summary || null,
        updated.source,
        updated.memoryType,
        updated.metadata ? JSON.stringify(updated.metadata) : null,
        updated.updatedAt,
        id
      );
      return updated;
    } catch (error) {
      throw new DatabaseError(`Failed to update memory ${id}`, 'UPDATE_MEMORY_FAILED', error);
    }
  }

  deleteMemory(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
    
    try {
      const result = stmt.run(id);
      const deleted = result.changes > 0;
      
      if (deleted) {
        this.vectorIndex.delete(id);
      }
      
      return deleted;
    } catch (error) {
      throw new DatabaseError(`Failed to delete memory ${id}`, 'DELETE_MEMORY_FAILED', error);
    }
  }

  getAllMemories(): Memory[] {
    const stmt = this.db.prepare(`
      SELECT m.*, (
        SELECT COUNT(*) 
        FROM edges e 
        WHERE e.source_id = m.id OR e.target_id = m.id
      ) as connection_count 
      FROM memories m 
      ORDER BY m.created_at DESC
    `);
    
    try {
      const rows = stmt.all() as any[];
      return rows.map(row => this.mapRowToMemory(row));
    } catch (error) {
      throw new DatabaseError('Failed to get all memories', 'GET_ALL_MEMORIES_FAILED', error);
    }
  }

  getMemoriesBySession(sessionId: string): Memory[] {
    const stmt = this.db.prepare(`
      SELECT m.*, 0 as connection_count
      FROM memories m
      JOIN session_memories sm ON m.id = sm.memory_id
      WHERE sm.session_id = ?
      ORDER BY sm.relevance_score DESC
    `);
    
    try {
      const rows = stmt.all(sessionId) as any[];
      return rows.map(row => this.mapRowToMemory(row));
    } catch (error) {
      throw new DatabaseError(`Failed to get memories for session ${sessionId}`, 'GET_SESSION_MEMORIES_FAILED', error);
    }
  }

  countMemories(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM memories');
    
    try {
      const result = stmt.get() as { count: number };
      return result.count;
    } catch (error) {
      throw new DatabaseError('Failed to count memories', 'COUNT_MEMORIES_FAILED', error);
    }
  }

  /**
   * Clears all data from the database.
   */
  reset(): void {
    try {
      this.db.transaction(() => {
        this.db.exec('DELETE FROM memories');
        this.db.exec('DELETE FROM embeddings');
        this.db.exec('DELETE FROM edges');
        this.db.exec('DELETE FROM session_memories');
        this.db.exec('DELETE FROM memory_vectors');
      })();
      logger.info('Database reset successful');
    } catch (error) {
      throw new DatabaseError('Failed to reset database', 'RESET_FAILED', error);
    }
  }

  getDatabaseSize(): number {
    try {
      const stats = statSync(this.dbPath);
      return stats.size;
    } catch (error) {
      throw new DatabaseError(`Failed to get database size for ${this.dbPath}`, 'GET_DB_SIZE_FAILED', error);
    }
  }

  /**
   * Insert or replace an embedding for a memory.
   * Converts the number[] vector to a Buffer (Float32Array) for SQLite BLOB storage.
   */
  upsertEmbedding(embedding: EmbeddingVector): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO embeddings (memory_id, vector, model, dimensions, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    try {
      const floatArray = new Float32Array(embedding.vector);
      const buffer = Buffer.from(floatArray.buffer);

      stmt.run(
        embedding.memoryId,
        buffer,
        embedding.model,
        embedding.dimensions,
        embedding.createdAt || Date.now()
      );

      // Sync with VectorIndex
      this.vectorIndex.insert(embedding.memoryId, embedding.vector);
    } catch (error) {
      throw new DatabaseError(`Failed to upsert embedding for memory ${embedding.memoryId}`, 'UPSERT_EMBEDDING_FAILED', error);
    }
  }

  /**
   * Retrieves an embedding for a memory.
   * Converts the SQLite BLOB (Buffer) back to a number[].
   */
  getEmbedding(memoryId: string): EmbeddingVector | null {
    const stmt = this.db.prepare('SELECT * FROM embeddings WHERE memory_id = ?');
    
    try {
      const row = stmt.get(memoryId) as any;
      if (!row) return null;

      const buffer = row.vector as Buffer;
      const floatArray = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Float32Array.BYTES_PER_ELEMENT);
      
      return {
        memoryId: row.memory_id,
        vector: Array.from(floatArray),
        model: row.model,
        dimensions: row.dimensions,
        createdAt: row.created_at
      };
    } catch (error) {
      throw new DatabaseError(`Failed to get embedding for memory ${memoryId}`, 'GET_EMBEDDING_FAILED', error);
    }
  }

  /**
   * Deletes an embedding. Note that embeddings are usually deleted via CASCADE when a memory is deleted.
   */
  deleteEmbedding(memoryId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM embeddings WHERE memory_id = ?');
    
    try {
      const result = stmt.run(memoryId);
      return result.changes > 0;
    } catch (error) {
      throw new DatabaseError(`Failed to delete embedding for memory ${memoryId}`, 'DELETE_EMBEDDING_FAILED', error);
    }
  }

  private mapRowToMemory(row: any): Memory {
    return {
      id: row.id,
      content: row.content,
      summary: row.summary,
      source: row.source,
      memoryType: row.memory_type,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      accessCount: row.access_count,
      connectionCount: row.connection_count, // Añadido para el grafo
      lastAccessedAt: row.last_accessed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
