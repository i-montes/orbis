import { describe, expect, test, beforeEach, afterEach, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { Memor } from '../src/memor.js';
import { setConfig, getConfig } from '@orbis/shared';

describe('Auto-Linking Graph', () => {
  const testDbPath = join(import.meta.dir, `suite-graph-final.db`);
  let memor: Memor;
  let originalConfig: any;

  beforeEach(async () => {
    originalConfig = { ...getConfig() };
    
    // Set a predictable threshold for testing and force local provider
    setConfig({
      ...originalConfig,
      memor: {
        ...originalConfig.memor,
        autoEdgeThreshold: 0.60, // use 0.60 for local provider
        embedding: { providers: {} } // Force fallback to LocalEmbeddingProvider (Xenova/bge-m3)
      }
    });

    memor = new Memor(testDbPath);
    
    // Clear data between tests
    const db = (memor.store as any).db;
    db.exec('DELETE FROM memories');
    db.exec('DELETE FROM embeddings');
    db.exec('DELETE FROM memory_vectors');
    db.exec('DELETE FROM edges');
  }, { timeout: 120000 });

  afterEach(() => {
    setConfig(originalConfig);
  });

  afterAll(async () => {
    if (memor) memor.close();
    
    // Robust cleanup with multiple retries for Windows
    const files = [testDbPath, testDbPath + '-wal', testDbPath + '-shm'];
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      let allDeleted = true;
      for (const file of files) {
        try {
          if (existsSync(file)) unlinkSync(file);
        } catch (e) {
          allDeleted = false;
        }
      }
      if (allDeleted) break;
    }
  }, { timeout: 20000 });

  test('addMemory(): should automatically link similar memories', async () => {
    // 1. Insert first memory (A)
    const memA = await memor.addMemory({
      content: 'El cielo es de color azul y muy despejado hoy',
      source: 'USER',
      memoryType: 'FACT'
    });

    // 2. Insert similar memory (B)
    const memB = await memor.addMemory({
      content: 'Hoy el cielo se ve muy azulado y claro',
      source: 'USER',
      memoryType: 'FACT'
    });

    // 3. Verify that an edge was created from B to A
    const db = (memor.store as any).db;
    const stmt = db.prepare('SELECT * FROM edges WHERE source_id = ? AND target_id = ?');
    const edge = stmt.get(memB.id, memA.id) as any;

    expect(edge).toBeDefined();
    expect(edge).not.toBeNull();
    expect(edge.relation_type).toBe('related_to');
    expect(edge.weight).toBeGreaterThanOrEqual(0.60);

    // 4. Insert completely unrelated memory (C)
    const memC = await memor.addMemory({
      content: 'La receta de la tarta de manzana requiere mucha azúcar',
      source: 'USER',
      memoryType: 'FACT'
    });

    // 5. Verify NO edges were created for C
    const noEdgesStmt = db.prepare('SELECT COUNT(*) as count FROM edges WHERE source_id = ?');
    const cEdges = noEdgesStmt.get(memC.id) as { count: number };
    
    expect(cEdges.count).toBe(0);
  }, { timeout: 60000 });
});
