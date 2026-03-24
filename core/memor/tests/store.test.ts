import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { MemorStore } from '../src/store/store.js';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { Database } from 'bun:sqlite';
import { type MemorySource, type MemoryType, findProjectRoot } from '@orbis/shared';

describe('MemorStore', () => {
  let store: MemorStore;
  let currentDbPath: string;

  beforeEach(() => {
    // Generate a unique path for each test to avoid file locking issues on Windows
    currentDbPath = join(import.meta.dir, `test-${Date.now()}-${Math.floor(Math.random() * 10000)}.db`);
    store = new MemorStore(currentDbPath);
  });

  afterEach(() => {
    if (store) store.close();
    // Try to clean up the db file and its WAL/SHM files
    try {
      if (existsSync(currentDbPath)) unlinkSync(currentDbPath);
      if (existsSync(currentDbPath + '-wal')) unlinkSync(currentDbPath + '-wal');
      if (existsSync(currentDbPath + '-shm')) unlinkSync(currentDbPath + '-shm');
    } catch (e) {
      // Ignore cleanup errors on Windows due to delayed lock release
    }
  });

  test('Inicialización: debe crear la base de datos y las tablas', () => {
    expect(existsSync(currentDbPath)).toBe(true);

    const db = new Database(currentDbPath);
    const tables = ['memories', 'embeddings', 'edges', 'sessions', 'session_memories', '_migrations'];
    for (const table of tables) {
      const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`).get();
      expect(row).not.toBeNull();
    }
    
    const migration = db.prepare(`SELECT COUNT(*) as count FROM _migrations`).get() as { count: number };
    expect(migration.count).toBe(1);
    
    db.close();
  });

  test('insertMemory: inserta un recuerdo y retorna objeto completo', () => {
    const memory = store.insertMemory({
      content: 'test content',
      source: 'USER',
      memoryType: 'FACT',
      metadata: { foo: 'bar' }
    });

    expect(memory.id).toBeDefined();
    expect(typeof memory.id).toBe('string');
    expect(memory.accessCount).toBe(0);
    expect(memory.content).toBe('test content');
    expect(memory.source).toBe('USER');
    expect(memory.memoryType).toBe('FACT');
    expect(memory.createdAt).toBeDefined();
    expect(memory.updatedAt).toBe(memory.createdAt);
    expect(memory.metadata).toEqual({ foo: 'bar' });
  });

  test('insertMemory: genera ID si no se proporciona', () => {
    const m1 = store.insertMemory({ content: 'c1', source: 'SYSTEM', memoryType: 'WORLD' });
    const m2 = store.insertMemory({ id: 'custom-id', content: 'c2', source: 'SYSTEM', memoryType: 'WORLD' });
    
    expect(m1.id).toHaveLength(36); // UUID
    expect(m2.id).toBe('custom-id');
  });

  test('getMemoryById: retorna memoria existente y deserializa metadata', () => {
    const inserted = store.insertMemory({
      content: 'test fetch',
      source: 'AGENT',
      memoryType: 'DECISION',
      metadata: { deep: { nested: true } }
    });

    const fetched = store.getMemoryById(inserted.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.content).toBe('test fetch');
    expect(fetched?.metadata).toEqual({ deep: { nested: true } });
    expect(fetched?.updatedAt).toBe(inserted.updatedAt);
  });

  test('updateAccessStats: incrementa accessCount y actualiza lastAccessedAt', async () => {
    const memory = store.insertMemory({
      content: 'stats test',
      source: 'USER',
      memoryType: 'EXPERIENCE'
    });

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    store.updateAccessStats(memory.id);

    const fetched = store.getMemoryById(memory.id);
    expect(fetched?.accessCount).toBe(1);
    expect(fetched?.lastAccessedAt).toBeDefined();
    expect(fetched!.lastAccessedAt!).toBeGreaterThan(memory.createdAt);
  });

  test('deleteMemory: borra correctamente y cascadea a otras tablas', () => {
    const memory = store.insertMemory({
      content: 'cascade test',
      source: 'SYSTEM',
      memoryType: 'TASK'
    });

    // Insert related data directly
    const db = new Database(currentDbPath);
    db.exec(`INSERT INTO embeddings (memory_id, vector, model, dimensions, created_at) VALUES ('${memory.id}', x'00', 'test', 1, 1)`);
    db.close();

    expect(store.deleteMemory(memory.id)).toBe(true);
    expect(store.getMemoryById(memory.id)).toBeNull();

    // Verify cascade
    const db2 = new Database(currentDbPath);
    const emb = db2.prepare(`SELECT * FROM embeddings WHERE memory_id = ?`).get(memory.id);
    expect(emb).toBeNull();
    db2.close();
  });

  test('getAllMemories: retorna todos ordenados por createdAt DESC', async () => {
    store.insertMemory({ content: 'older', source: 'USER', memoryType: 'FACT' });
    await new Promise(resolve => setTimeout(resolve, 10));
    store.insertMemory({ content: 'newer', source: 'USER', memoryType: 'FACT' });

    const all = store.getAllMemories();
    expect(all.length).toBe(2);
    expect(all[0].content).toBe('newer');
    expect(all[1].content).toBe('older');
  });

  test('getMemoriesBySession: retorna memorias de la sesion por relevancia', () => {
    const m1 = store.insertMemory({ content: 'c1', source: 'USER', memoryType: 'FACT' });
    const m2 = store.insertMemory({ content: 'c2', source: 'USER', memoryType: 'FACT' });
    
    const db = new Database(currentDbPath);
    db.exec(`INSERT INTO sessions (id, created_at) VALUES ('s1', 1)`);
    db.exec(`INSERT INTO session_memories (session_id, memory_id, relevance_score) VALUES ('s1', '${m1.id}', 0.5)`);
    db.exec(`INSERT INTO session_memories (session_id, memory_id, relevance_score) VALUES ('s1', '${m2.id}', 0.9)`);
    db.close();

    const results = store.getMemoriesBySession('s1');
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(m2.id); // higher score first
  });

  test('getDatabaseSize: retorna un valor numérico positivo', () => {
    store.insertMemory({ content: 'data', source: 'SYSTEM', memoryType: 'WORLD' });
    expect(store.getDatabaseSize()).toBeGreaterThan(0);
  });

  test('Criterio de Salida: debe crear data/memor.db en la raíz con la configuración por defecto', () => {
    // Instanciamos sin path para usar el del orbis.config.json (data/memor.db)
    const defaultStore = new MemorStore();
    defaultStore.insertMemory({ 
      content: 'persist test', 
      source: 'SYSTEM', 
      memoryType: 'FACT' 
    });
    defaultStore.close();

    // Verificamos que el archivo existe en la ruta absoluta de la raíz
    const projectRoot = findProjectRoot();
    const dbPath = join(projectRoot, 'data/memor.db');
    expect(existsSync(dbPath)).toBe(true);
  });
});
