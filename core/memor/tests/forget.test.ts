import { describe, expect, test, beforeEach, afterEach, afterAll } from 'bun:test';
import { Memor } from '../src/memor.js';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';

describe('Memor: Derecho al Olvido (forget)', () => {
  let memor: Memor;
  const testDbPath = join(import.meta.dir, `suite-forget-${Date.now()}.db`);

  beforeEach(() => {
    memor = new Memor(testDbPath);
  });

  afterEach(() => {
    if (memor) memor.close();
  });

  afterAll(async () => {
    const files = [testDbPath, testDbPath + '-wal', testDbPath + '-shm'];
    
    // Wait for DB to fully close and then cleanup
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

  test('deleteMemory: debe eliminar el recuerdo, sus embeddings y relaciones en cascada', async () => {
    // 1. Crear un par de recuerdos relacionados
    const m1 = await memor.addMemory({
      content: 'El cielo es azul',
      source: 'USER',
      memoryType: 'FACT'
    });

    const m2 = await memor.addMemory({
      content: 'El mar refleja el cielo',
      source: 'USER',
      memoryType: 'FACT'
    });

    // Crear una relación explícita
    memor.addEdge(m1.id, m2.id, 'related_to');

    // Verificar estado inicial
    const statsInitial = memor.getStats();
    expect(statsInitial.memories).toBe(2);
    expect(statsInitial.edges).toBeGreaterThanOrEqual(1);

    // 2. Ejecutar "forget" para m1
    const result = memor.deleteMemory(m1.id);
    expect(result).toBe(true);

    // 3. Verificar limpieza
    const statsFinal = memor.getStats();
    
    // Solo queda 1 recuerdo (m2)
    expect(statsFinal.memories).toBe(1);
    
    // El recuerdo eliminado ya no existe
    const searchRes = await memor.search('azul', { topK: 10 });
    const found = searchRes.some(r => r.memory.id === m1.id);
    expect(found).toBe(false);

    // Las relaciones de m1 deben haber desaparecido por CASCADE
    // m1 era parte de al menos una arista (la que creamos manualmente + posibles automáticas)
    // El conteo de edges debería haber disminuido
    expect(statsFinal.edges).toBeLessThan(statsInitial.edges);
  });

  test('deleteMemory: retorna false si el ID no existe', () => {
    const result = memor.deleteMemory('no-existe-id');
    expect(result).toBe(false);
  });
});
