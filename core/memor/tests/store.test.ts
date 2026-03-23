import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { MemorStore } from '../src/store/store.js';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { Database } from 'bun:sqlite';

describe('MemorStore', () => {
  let store: MemorStore;
  let currentDbPath: string;

  beforeEach(() => {
    // Generate a unique path for each test to avoid file locking issues on Windows
    currentDbPath = join(import.meta.dir, `../../../../data/test-${Date.now()}-${Math.floor(Math.random() * 10000)}.db`);
    store = new MemorStore(currentDbPath);
  });

  afterEach(() => {
    store.close();
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
    const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='memories'`).get();
    expect(row).not.toBeNull();
    db.close();
  });

  test('insertMemory: inserta un recuerdo y retorna objeto con id y accessCount 0', () => {
    const memory = store.insertMemory({
      content: 'test content',
      createdAt: Date.now(),
      memoryType: 'FACT',
      metadata: { foo: 'bar' }
    });

    expect(memory.id).toBeDefined();
    expect(typeof memory.id).toBe('string');
    expect(memory.accessCount).toBe(0);
    expect(memory.content).toBe('test content');
    expect(memory.memoryType).toBe('FACT');
    expect(memory.metadata).toEqual({ foo: 'bar' });
  });

  test('insertMemory: arroja error por constraint de id duplicado', () => {
    const memoryInput = {
      id: 'custom-id-1',
      content: 'test content',
      createdAt: Date.now(),
      memoryType: 'FACT' as const
    };

    store.insertMemory(memoryInput);

    expect(() => {
      store.insertMemory(memoryInput);
    }).toThrow();
  });

  test('getMemoryById: retorna memoria existente y deserializa metadata', () => {
    const inserted = store.insertMemory({
      content: 'test fetch',
      createdAt: Date.now(),
      memoryType: 'DECISION',
      metadata: { deep: { nested: true } }
    });

    const fetched = store.getMemoryById(inserted.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.content).toBe('test fetch');
    expect(fetched?.metadata).toEqual({ deep: { nested: true } });
  });

  test('getMemoryById: retorna null si no existe', () => {
    const fetched = store.getMemoryById('non-existent-id');
    expect(fetched).toBeNull();
  });

  test('updateAccessStats: incrementa accessCount y actualiza lastAccessedAt', () => {
    const memory = store.insertMemory({
      content: 'stats test',
      createdAt: Date.now() - 10000, // 10s en el pasado
      memoryType: 'EXPERIENCE'
    });

    expect(memory.accessCount).toBe(0);
    expect(memory.lastAccessedAt).toBeUndefined();

    store.updateAccessStats(memory.id);

    const fetched = store.getMemoryById(memory.id);
    expect(fetched?.accessCount).toBe(1);
    expect(fetched?.lastAccessedAt).toBeGreaterThan(memory.createdAt);
  });

  test('deleteMemory: borra correctamente y retorna booleano', () => {
    const memory = store.insertMemory({
      content: 'delete test',
      createdAt: Date.now(),
      memoryType: 'TASK'
    });

    expect(store.getMemoryById(memory.id)).not.toBeNull();

    const deleted = store.deleteMemory(memory.id);
    expect(deleted).toBe(true);
    expect(store.getMemoryById(memory.id)).toBeNull();

    const deletedAgain = store.deleteMemory(memory.id);
    expect(deletedAgain).toBe(false);
  });

  test('getAllMemories: retorna todos ordenados por fecha', () => {
    store.insertMemory({ id: 'm1', content: 'older', createdAt: 100, memoryType: 'FACT' });
    store.insertMemory({ id: 'm2', content: 'newer', createdAt: 200, memoryType: 'FACT' });

    const all = store.getAllMemories();
    expect(all.length).toBe(2);
    expect(all[0].id).toBe('m2'); // newer first
    expect(all[1].id).toBe('m1');
  });

  test('getMemoriesBySession: retorna memorias de la sesion correctamente', () => {
    const m1 = store.insertMemory({ content: 'c1', createdAt: 1, memoryType: 'FACT' });
    const m2 = store.insertMemory({ content: 'c2', createdAt: 2, memoryType: 'FACT' });
    
    // Insert dummy session and session_memories using direct DB access for testing
    const db = new Database(currentDbPath);
    db.exec(`INSERT INTO sessions (id, created_at) VALUES ('s1', 1)`);
    db.exec(`INSERT INTO session_memories (session_id, memory_id, relevance_score) VALUES ('s1', '${m1.id}', 0.8)`);
    db.exec(`INSERT INTO session_memories (session_id, memory_id, relevance_score) VALUES ('s1', '${m2.id}', 0.9)`);
    db.close();

    const sessionMemories = store.getMemoriesBySession('s1');
    expect(sessionMemories.length).toBe(2);
    // Highest relevance score first
    expect(sessionMemories[0].id).toBe(m2.id); 
    expect(sessionMemories[1].id).toBe(m1.id);
  });

  test('countMemories: retorna el conteo correcto', () => {
    expect(store.countMemories()).toBe(0);
    store.insertMemory({ content: '1', createdAt: 1, memoryType: 'FACT' });
    store.insertMemory({ content: '2', createdAt: 2, memoryType: 'FACT' });
    expect(store.countMemories()).toBe(2);
  });

  test('getDatabaseSize: retorna tamanio de archivo > 0', () => {
    store.insertMemory({ content: 'fill', createdAt: 1, memoryType: 'FACT' });
    expect(store.getDatabaseSize()).toBeGreaterThan(0);
  });
});