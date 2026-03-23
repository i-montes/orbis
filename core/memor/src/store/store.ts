import { Database } from 'bun:sqlite';
import { runMigrations } from './migrations/index.js';
import { createLogger, DatabaseError, getConfig, generateId, type Memory } from '@orbis/shared';
import { mkdirSync, statSync } from 'fs';
import { dirname, join } from 'path';

const logger = createLogger('memor:store');

export type InsertMemoryParams = Omit<Memory, 'id' | 'accessCount'> & { id?: string };

export class MemorStore {
  private db: Database;
  private dbPath: string = '';

  constructor(customPath?: string) {
    try {
      if (customPath) {
        this.dbPath = customPath;
      } else {
        const config = getConfig();
        this.dbPath = join(config.data.path, config.memor.database);
      }

      mkdirSync(dirname(this.dbPath), { recursive: true });

      this.db = new Database(this.dbPath);
      
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA foreign_keys = ON;');
      this.db.exec('PRAGMA synchronous = NORMAL;');

      logger.info(`Opened database at ${this.dbPath}`);
      
      runMigrations(this.db);
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

  insertMemory(memoryInput: InsertMemoryParams): Memory {
    const memory: Memory = {
      ...memoryInput,
      id: memoryInput.id || generateId(),
      accessCount: 0
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
        memory.source || 'SYSTEM',
        memory.memoryType,
        memory.metadata ? JSON.stringify(memory.metadata) : null,
        memory.accessCount,
        memory.lastAccessedAt || null,
        memory.createdAt,
        Date.now()
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

  deleteMemory(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
    
    try {
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      throw new DatabaseError(`Failed to delete memory ${id}`, 'DELETE_MEMORY_FAILED', error);
    }
  }

  getAllMemories(): Memory[] {
    const stmt = this.db.prepare('SELECT * FROM memories ORDER BY created_at DESC');
    
    try {
      const rows = stmt.all() as any[];
      return rows.map(row => this.mapRowToMemory(row));
    } catch (error) {
      throw new DatabaseError('Failed to get all memories', 'GET_ALL_MEMORIES_FAILED', error);
    }
  }

  getMemoriesBySession(sessionId: string): Memory[] {
    const stmt = this.db.prepare(`
      SELECT m.* 
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

  getDatabaseSize(): number {
    try {
      const stats = statSync(this.dbPath);
      return stats.size;
    } catch (error) {
      throw new DatabaseError(`Failed to get database size for ${this.dbPath}`, 'GET_DB_SIZE_FAILED', error);
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
      lastAccessedAt: row.last_accessed_at,
      createdAt: row.created_at
    };
  }
}
