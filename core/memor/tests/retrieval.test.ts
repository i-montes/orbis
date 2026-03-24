import { describe, expect, test, beforeEach, afterEach, afterAll, beforeAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { MemorStore } from '../src/store/store.js';
import { VectorIndex } from '../src/vectors/index.js';
import { EmbeddingManager } from '../src/embeddings/manager.js';
import { GraphManager } from '../src/graph/manager.js';
import { search } from '../src/retrieval/search.js';
import { calculateRecencyScore, calculateCombinedScore, calculateSemanticScore } from '../src/retrieval/scoring.js';
import { normalizeVector } from '../src/vectors/similarity.js';
import { setConfig, getConfig } from '@orbis/shared';

describe('Retrieval & Ranking', () => {
  const testDbPath = join(import.meta.dir, `suite-retrieval-final.db`);
  let store: MemorStore;
  let manager: EmbeddingManager;
  let vectorIndex: VectorIndex;
  let graph: GraphManager;
  let originalConfig: any;

  beforeAll(async () => {
    store = new MemorStore(testDbPath);
    manager = new EmbeddingManager(store);
    vectorIndex = store.vectorIndex;
    graph = new GraphManager(store.db);
  }, { timeout: 120000 });

  beforeEach(async () => {
    originalConfig = { ...getConfig() };
    const db = store.db;
    db.exec('DELETE FROM memories');
    db.exec('DELETE FROM embeddings');
    db.exec('DELETE FROM memory_vectors');
    db.exec('DELETE FROM edges');
    db.exec('DELETE FROM session_memories');
  });

  afterEach(() => {
    setConfig(originalConfig);
  });

  afterAll(async () => {
    if (store) {
      try {
        store.close();
      } catch (e) {}
    }
    
    // Give Windows extra time and use a more robust loop
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
  }, { timeout: 20000 }); // Increase hook timeout to 20s

  async function seedBasicMemories() {
    const contents = [
      'La capital de Francia es París',
      'Cómo cocinar una tortilla de patatas',
      'El clima en el desierto es muy seco',
      'JavaScript es un lenguaje de programación',
      'Orbis es un sistema de agentes con memoria'
    ];

    const memories = contents.map(content => 
      store.insertMemory({ content, source: 'USER', memoryType: 'FACT' })
    );

    await manager.generateAndStoreMany(
      memories.map(m => ({ memoryId: m.id, text: m.content }))
    );
    return memories;
  }

  describe('VectorIndex', () => {
    test('insert() y count(): maneja el conteo correctamente', async () => {
      await seedBasicMemories();
      expect(vectorIndex.count()).toBe(5);
    });

    test('delete(): reduce el conteo al eliminar', async () => {
      const memories = await seedBasicMemories();
      vectorIndex.delete(memories[0]!.id);
      expect(vectorIndex.count()).toBe(4);
    });

    test('search(): retorna resultados ordenados por distancia y respeta el limit', async () => {
      await seedBasicMemories();
      const queryVec = await manager.generateQueryVector('Francia');
      const results = vectorIndex.search(queryVec, 3);
      
      expect(results.length).toBe(3);
      expect(results[0]!.distance).toBeLessThanOrEqual(results[1]!.distance);
    });
  });

  describe('Scoring (Unit)', () => {
    test('recencyScore(): calcula decaimiento temporal correctamente', () => {
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      expect(calculateRecencyScore(now, 0.1)).toBeCloseTo(1.0, 2);
      expect(calculateRecencyScore(thirtyDaysAgo, 0.1)).toBeCloseTo(0.05, 2); 
    });

    test('semanticScore(): identidad es 1.0', () => {
      expect(calculateSemanticScore(0)).toBe(1.0);
    });

    test('normalizeVector(): normaliza a norma 1', () => {
      const vec = [3, 4];
      const norm = normalizeVector(vec);
      expect(norm[0]).toBe(0.6);
      expect(norm[1]).toBe(0.8);
    });
  });

  describe('search() Orchestration', () => {
    test('Relevancia semántica: encuentra el recuerdo más parecido', async () => {
      await seedBasicMemories();
      const results = await search('Háblame sobre lenguajes de programación', store, vectorIndex, manager, graph, {
        topK: 1
      });
      expect(results[0]!.memory.content).toContain('JavaScript');
    });

    test('topK: limita los resultados', async () => {
      await seedBasicMemories();
      const results = await search('agentes', store, vectorIndex, manager, graph, {
        topK: 3
      });
      expect(results.length).toBe(3);
    });

    test('Estadísticas: incrementa accessCount', async () => {
      const id = (await seedBasicMemories())[1]!.id;
      const initial = store.getMemoryById(id)?.accessCount || 0;
      
      await search('tortilla', store, vectorIndex, manager, graph, { topK: 1 });
      
      const updated = store.getMemoryById(id)?.accessCount || 0;
      expect(updated).toBe(initial + 1);
    });

    test('recency_lambda: afecta el ranking final', async () => {
      const content = 'Mismo contenido';
      const m1 = store.insertMemory({ content, source: 'USER', memoryType: 'FACT' });
      const m2 = store.insertMemory({ content, source: 'USER', memoryType: 'FACT' });
      
      await manager.generateAndStoreMany([
        { memoryId: m1.id, text: content }, 
        { memoryId: m2.id, text: content }
      ]);

      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const db = store.db;
      db.exec(`UPDATE memories SET created_at = ${thirtyDaysAgo} WHERE id = '${m1.id}'`);
      db.exec(`UPDATE embeddings SET created_at = ${thirtyDaysAgo} WHERE memory_id = '${m1.id}'`);

      const resultsRecency = await search(content, store, vectorIndex, manager, graph, { topK: 10, lambda: 2 });
      expect(resultsRecency[0]!.memory.id).toBe(m2.id); 
      const oldRes = resultsRecency.find(r => r.memory.id === m1.id);
      expect(oldRes!.recencyScore).toBeLessThan(0.001);
    });

    test('SearchResult: contiene todos los scores requeridos', async () => {
      await seedBasicMemories();
      const results = await search('Francia', store, vectorIndex, manager, graph, { topK: 1 });
      const r = results[0]!;
      expect(r.semanticScore).toBeDefined();
      expect(r.recencyScore).toBeDefined();
      expect(r.score).toBeDefined();
    });
  });
});
