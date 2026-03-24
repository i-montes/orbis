import { describe, expect, test, beforeEach, afterEach, afterAll } from 'bun:test';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { Memor } from '../src/memor.js';
import { setConfig, getConfig } from '@orbis/shared';

describe('Graph-Augmented Retrieval', () => {
  const testDbPath = join(import.meta.dir, `suite-graph-retrieval-${Date.now()}.db`);
  let memor: Memor;
  let originalConfig: any;

  beforeEach(async () => {
    originalConfig = { ...getConfig() };
    
    // Set a predictable threshold for testing
    setConfig({
      ...originalConfig,
      memor: {
        ...originalConfig.memor,
        autoEdgeThreshold: 0.60, // moderate threshold
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

  test('search(): should retrieve connected memories via graph expansion', async () => {
    // 1. Memory A: The secret code (doesn't mention location)
    const memA = await memor.addMemory({
      content: 'El código secreto de la caja fuerte es 4321',
      source: 'USER',
      memoryType: 'FACT'
    });

    // 2. Memory B: The vault location (mentions location, links to A via "caja fuerte")
    const memB = await memor.addMemory({
      content: 'La caja fuerte se encuentra oculta en el sótano, tras una pared falsa',
      source: 'USER',
      memoryType: 'FACT'
    });

    // Verify they are linked
    const db = (memor.store as any).db;
    const edge = db.prepare('SELECT * FROM edges WHERE (source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?)')
                   .get(memA.id, memB.id, memB.id, memA.id);
    expect(edge).not.toBeNull();

    // 3. Search for location
    const query = '¿En qué lugar está la caja fuerte?';

    // 3a. Search WITHOUT expansion
    const resultsNoGraph = await memor.search(query, { topK: 1, expandGraph: false });
    expect(resultsNoGraph.length).toBe(1);
    expect(resultsNoGraph[0].memory.id).toBe(memB.id); // memB contains the actual answer
    expect(resultsNoGraph.find(r => r.memory.id === memA.id)).toBeUndefined();

    // 3b. Search WITH expansion
    const resultsWithGraph = await memor.search(query, { topK: 5, expandGraph: true });
    
    const foundA = resultsWithGraph.find(r => r.memory.id === memA.id);
    const foundB = resultsWithGraph.find(r => r.memory.id === memB.id);

    expect(foundB).toBeDefined();
    expect(foundA).toBeDefined(); // Dragged by the graph!
    expect(foundA!.score).toBeLessThan(foundB!.score); // penalizado por ser indirecto
    expect(foundA!.semanticScore).toBeGreaterThan(0);
  }, { timeout: 60000 });
});
