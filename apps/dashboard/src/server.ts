import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { Memor } from '@orbis/memor';

const app = new Hono();

// API Endpoint for Knowledge Graph
app.get('/api/graph', async (c) => {
  const memor = new Memor();
  try {
    const memories = memor.getAllMemories();
    const edges = memor.getAllEdges();
    
    // Usamos escala logarítmica para que la importancia sea más visible 
    // incluso con pocas diferencias de acceso (evita el efecto binario azul/rojo)
    const maxAccess = Math.max(...memories.map(m => m.accessCount || 0), 1);
    const logMax = Math.log10(maxAccess + 1);

    const nodes = memories.map(m => {
      const count = m.accessCount || 0;
      const logImportance = Math.log10(count + 1) / logMax;
      
      return {
        id: m.id,
        name: m.summary || (m.content.length > 50 ? m.content.substring(0, 50) + '...' : m.content),
        content: m.content,
        summary: m.summary,
        source: m.source,
        accessCount: count,
        connectionCount: m.connectionCount || 0,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        lastAccessedAt: m.lastAccessedAt,
        metadata: m.metadata,
        val: Math.max(2, (m.connectionCount || 0) * 1.5), 
        importance: logImportance,
        group: m.memoryType
      };
    });
    
    const links = edges.map(e => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      value: e.weight,
      relationType: e.relationType
    }));
    
    return c.json({ nodes, links });
  } catch (error) {
    console.error('Error in Hono API:', error);
    return c.json({ error: 'Graph Data Error' }, 500);
  } finally {
    memor.close();
  }
});

// API Endpoint to Update a Memory
app.put('/api/memories/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const memor = new Memor();
  try {
    const updated = await memor.updateMemory(id, body);
    if (!updated) {
      return c.json({ error: 'Memory not found' }, 404);
    }
    return c.json(updated);
  } catch (error) {
    console.error('Error updating memory:', error);
    return c.json({ error: 'Update Failed' }, 500);
  } finally {
    memor.close();
  }
});

// API Endpoint to Delete a Memory
app.delete('/api/memories/:id', async (c) => {
  const id = c.req.param('id');
  const memor = new Memor();
  try {
    const deleted = memor.deleteMemory(id);
    if (!deleted) {
      return c.json({ error: 'Memory not found' }, 404);
    }
    return c.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting memory:', error);
    return c.json({ error: 'Deletion Failed' }, 500);
  } finally {
    memor.close();
  }
});

// Serve Vite build in Production
app.use('/*', serveStatic({ root: './dist' }));

// In dev, usually Vite serves itself.
console.log('Orbis Dashboard (Hono) running on http://localhost:3000');

export default {
  port: 3000,
  fetch: app.fetch,
};
