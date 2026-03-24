import { describe, expect, test, beforeEach, afterEach, afterAll, mock } from 'bun:test';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { MemorStore } from '../src/store/store.js';
import { EmbeddingManager } from '../src/embeddings/manager.js';
import { OpenAIEmbeddingProvider } from '../src/embeddings/providers/openai.js';
import { OllamaEmbeddingProvider } from '../src/embeddings/providers/ollama.js';
import { LocalEmbeddingProvider } from '../src/embeddings/providers/local.js';
import { createEmbeddingProvider } from '../src/embeddings/provider.js';
import { EmbeddingError, ConfigError, setConfig, getConfig } from '@orbis/shared';

describe('Embeddings: Serialization & Providers (Offline)', () => {
  let store: MemorStore;
  const testDbPath = join(import.meta.dir, `suite-embed-${Date.now()}.db`);
  let originalConfig: any;

  beforeEach(() => {
    store = new MemorStore(testDbPath);
    originalConfig = { ...getConfig() };
  });

  afterEach(() => {
    setConfig(originalConfig); // Restaurar config real
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
  });

  test('Store: serializa y deserializa vectores correctamente', () => {
    const memory = store.insertMemory({ content: 'vector test', source: 'SYSTEM', memoryType: 'FACT' });
    const originalVector = [0.1, -0.2, 0.3333333432674408, 0.0]; 

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
    
    for (let i = 0; i < originalVector.length; i++) {
      expect(retrieved!.vector[i]).toBeCloseTo(originalVector[i]);
    }
  });

  test('OpenAIEmbeddingProvider: lanza error sin API key al inicializar', async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const provider = new OpenAIEmbeddingProvider({ type: 'openai', model: 'test', dimensions: 100 });
    
    await expect(provider.initialize()).rejects.toThrow(EmbeddingError);

    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
  });

  test('Manager: cambia de proveedor según config (Local fallback)', async () => {
    // Forzamos que no haya proveedores configurados
    setConfig({
      ...originalConfig,
      memor: {
        ...originalConfig.memor,
        embedding: { providers: {} }
      }
    });

    const manager = new EmbeddingManager(store); 
    const memory = store.insertMemory({ content: 'test', source: 'USER', memoryType: 'FACT' });
    
    // El local Xenova/all-MiniLM-L6-v2 tiene 384 dims
    await manager.generateAndStore(memory.id, "hola");
    const vec = manager.getVector(memory.id);
    expect(vec?.length).toBe(384);
  });

  test('OllamaEmbeddingProvider: detección y auto-setup', async () => {
    const provider = new OllamaEmbeddingProvider({
      type: 'ollama',
      model: 'qwen3-embedding:0.6b', 
      dimensions: 1024
    });

    await provider.initialize();
    const vec = await provider.embed("test orbis con qwen3");
    expect(vec.length).toBe(1024);
  }, { timeout: 300000 }); 

  test('LocalEmbeddingProvider: genera vector real de 384 dimensiones', async () => {
    const provider = new LocalEmbeddingProvider();
    await provider.initialize();
    const vec = await provider.embed("Hola mundo");
    
    expect(vec.length).toBe(384);
    expect(typeof vec[0]).toBe('number');
  }, { timeout: 60000 });
});
