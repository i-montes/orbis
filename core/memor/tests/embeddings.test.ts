import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { MemorStore } from '../src/store/store.js';
import { EmbeddingManager } from '../src/embeddings/manager.js';
import { OpenAIEmbeddingProvider } from '../src/embeddings/providers/openai.js';
import { OllamaEmbeddingProvider } from '../src/embeddings/providers/ollama.js';
import { LocalEmbeddingProvider } from '../src/embeddings/providers/local.js';
import { createEmbeddingProvider } from '../src/embeddings/provider.js';
import { EmbeddingError, ConfigError } from '@orbis/shared';

describe('Embeddings: Serialization & Providers (Offline)', () => {
  let store: MemorStore;
  let currentDbPath: string;

  beforeEach(() => {
    currentDbPath = join(import.meta.dir, `test-embed-${Date.now()}-${Math.floor(Math.random() * 10000)}.db`);
    store = new MemorStore(currentDbPath);
  });

  afterEach(() => {
    if (store) store.close();
    try {
      if (existsSync(currentDbPath)) unlinkSync(currentDbPath);
      if (existsSync(currentDbPath + '-wal')) unlinkSync(currentDbPath + '-wal');
      if (existsSync(currentDbPath + '-shm')) unlinkSync(currentDbPath + '-shm');
    } catch (e) {}
  });

  test('Store: serializa y deserializa vectores correctamente', () => {
    const memory = store.insertMemory({ content: 'vector test', source: 'SYSTEM', memoryType: 'FACT' });
    const originalVector = [0.1, -0.2, 0.3333333432674408, 0.0]; // usar precision de float32 para asercion estricta

    store.upsertEmbedding({
      memoryId: memory.id,
      vector: originalVector,
      model: 'test-model',
      dimensions: 4,
      createdAt: Date.now()
    });

    const retrieved = store.getEmbedding(memory.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.model).toBe('test-model');
    expect(retrieved?.dimensions).toBe(4);
    
    // Float32 conversion check
    for (let i = 0; i < originalVector.length; i++) {
      expect(retrieved!.vector[i]).toBeCloseTo(originalVector[i]);
    }
  });

  test('Store: deleteEmbedding elimina el vector', () => {
    const memory = store.insertMemory({ content: 'delete test', source: 'SYSTEM', memoryType: 'FACT' });
    store.upsertEmbedding({ memoryId: memory.id, vector: [1, 2], model: 'test', dimensions: 2, createdAt: 1 });
    
    expect(store.getEmbedding(memory.id)).not.toBeNull();
    expect(store.deleteEmbedding(memory.id)).toBe(true);
    expect(store.getEmbedding(memory.id)).toBeNull();
  });

  test('Store: deleteMemory cascadea a deleteEmbedding', () => {
    const memory = store.insertMemory({ content: 'cascade', source: 'SYSTEM', memoryType: 'FACT' });
    store.upsertEmbedding({ memoryId: memory.id, vector: [1, 2], model: 'test', dimensions: 2, createdAt: 1 });
    
    store.deleteMemory(memory.id);
    expect(store.getEmbedding(memory.id)).toBeNull();
  });

  test('Manager: getVector retorna null para id inexistente', () => {
    const manager = new EmbeddingManager(store); // usará local por defecto si config está vacío
    expect(manager.getVector('no-existe')).toBeNull();
  });

  test('OpenAIEmbeddingProvider: lanza error sin API key', () => {
    // Aseguramos que no hay apiKey en el env
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    expect(() => {
      new OpenAIEmbeddingProvider({ type: 'openai', model: 'test', dimensions: 100 });
    }).toThrow(EmbeddingError);

    // Restaurar si existía
    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
  });

  test('createEmbeddingProvider: falla con alias inexistente', () => {
    // Si la config actual está vacía, no tiene aliases explicitos.
    expect(() => {
      createEmbeddingProvider('alias-que-no-existe');
    }).toThrow(ConfigError);
  });

  test.skip('LocalEmbeddingProvider: genera vector real de 256 dimensiones (requiere internet)', async () => {
    const provider = new LocalEmbeddingProvider();
    const vec = await provider.embed("Hola mundo");
    
    expect(vec.length).toBe(256);
    expect(typeof vec[0]).toBe('number');
  }, { timeout: 60000 });

  test.skip('LocalEmbeddingProvider: genera batch de vectores', async () => {
    const provider = new LocalEmbeddingProvider();
    const vectors = await provider.embedMany(["Hola", "Adiós", "Orbis"]);
    
    expect(vectors.length).toBe(3);
    expect(vectors[0]!.length).toBe(256);
    expect(vectors[1]!.length).toBe(256);
    expect(vectors[2]!.length).toBe(256);
  }, { timeout: 60000 });
});
