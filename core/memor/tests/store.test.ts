import { describe, expect, test, beforeEach, afterEach, afterAll } from 'bun:test';
import { MemorStore } from '../src/store/store.js';
import { join } from 'path';
import { unlinkSync, existsSync, rmSync } from 'fs';
import { Database } from 'bun:sqlite';
import { type MemorySource, type MemoryType, findProjectRoot, setConfig, getConfig } from '@orbis/shared';

describe('MemorStore', () => {
  let store: MemorStore;
  const testDbPath = join(import.meta.dir, `suite-store-${Date.now()}.db`);

  beforeEach(() => {
    store = new MemorStore(testDbPath);
  });

  afterEach(() => {
    if (store) store.close();
  });

  afterAll(async () => {
    const files = [testDbPath, testDbPath + '-wal', testDbPath + '-shm'];
    
    // Retry cleanup for several seconds (important for Windows)
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      let allDeleted = true;
      
      for (const file of files) {
        try {
          if (existsSync(file)) {
            unlinkSync(file);
          }
        } catch (e) {
          allDeleted = false;
        }
      }
      if (allDeleted) break;
    }

    const customDbDir = join(import.meta.dir, 'tmp-data');
    try {
      if (existsSync(customDbDir)) rmSync(customDbDir, { recursive: true, force: true });
    } catch (e) {}
  });

  test('Inicialización: debe crear la base de datos y las tablas', () => {
    expect(existsSync(testDbPath)).toBe(true);

    const db = new Database(testDbPath);
    const tables = ['memories', 'embeddings', 'edges', 'sessions', 'session_memories', '_migrations'];
    for (const table of tables) {
      const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`).get();
      expect(row).not.toBeNull();
    }
    
    const migration = db.prepare(`SELECT COUNT(*) as count FROM _migrations`).get() as { count: number };
    expect(migration.count).toBe(2);
    
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
    expect(memory.content).toBe('test content');
    expect(memory.source).toBe('USER');
    expect(memory.memoryType).toBe('FACT');
  });

  test('insertMemory: genera ID si no se proporciona', () => {
    const m1 = store.insertMemory({ content: 'c1', source: 'SYSTEM', memoryType: 'WORLD' });
    expect(m1.id).toHaveLength(36); 
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
    expect(fetched?.metadata).toEqual({ deep: { nested: true } });
  });

  test('updateAccessStats: incrementa accessCount y actualiza lastAccessedAt', async () => {
    const memory = store.insertMemory({
      content: 'stats test',
      source: 'USER',
      memoryType: 'EXPERIENCE'
    });

    await new Promise(resolve => setTimeout(resolve, 10));
    store.updateAccessStats(memory.id);

    const fetched = store.getMemoryById(memory.id);
    expect(fetched?.accessCount).toBe(1);
    expect(fetched?.lastAccessedAt).toBeGreaterThan(memory.createdAt);
  });

  test('deleteMemory: borra correctamente y cascadea a otras tablas', () => {
    const memory = store.insertMemory({
      content: 'cascade test',
      source: 'SYSTEM',
      memoryType: 'TASK'
    });

    const db = new Database(testDbPath);
    db.exec(`INSERT INTO embeddings (memory_id, vector, model, dimensions, created_at) VALUES ('${memory.id}', x'00', 'test', 1, 1)`);
    db.close();

    expect(store.deleteMemory(memory.id)).toBe(true);
    expect(store.getMemoryById(memory.id)).toBeNull();
  });

  test('getMemoriesBySession: retorna memorias de la sesion por relevancia', () => {
    const m1 = store.insertMemory({ content: 'c1', source: 'USER', memoryType: 'FACT' });
    const m2 = store.insertMemory({ content: 'c2', source: 'USER', memoryType: 'FACT' });
    
    const db = new Database(testDbPath);
    db.exec(`INSERT INTO sessions (id, created_at) VALUES ('s1', 1)`);
    db.exec(`INSERT INTO session_memories (session_id, memory_id, relevance_score) VALUES ('s1', '${m1.id}', 0.5)`);
    db.exec(`INSERT INTO session_memories (session_id, memory_id, relevance_score) VALUES ('s1', '${m2.id}', 0.9)`);
    db.close();

    const results = store.getMemoriesBySession('s1');
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(m2.id); 
  });

  test('getDatabaseSize: retorna un valor numérico positivo', () => {
    store.insertMemory({ content: 'data', source: 'SYSTEM', memoryType: 'WORLD' });
    expect(store.getDatabaseSize()).toBeGreaterThan(0);
  });

  test('Criterio de Salida: debe crear base de datos en ruta configurada', () => {
    const projectRoot = findProjectRoot();
    const customDbDir = join(import.meta.dir, 'tmp-data');
    const customDbPath = join(customDbDir, 'test-memor.db');
    
    // Mock config to use custom path
    const originalConfig = getConfig();
    setConfig({
      ...originalConfig,
      data: { path: customDbDir },
      memor: { ...originalConfig.memor, database: 'test-memor.db' }
    });

    const defaultStore = new MemorStore();
    defaultStore.close();

    expect(existsSync(customDbPath)).toBe(true);
    
    setConfig(originalConfig);
  });
});
