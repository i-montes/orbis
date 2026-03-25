import React, { useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function App() {
  const [data, setData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const response = await fetch('/api/graph');
        const json = await response.json();
        setData(json);
      } catch (err) {
        console.error('Failed to load graph:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGraph();
  }, []);

  // Sync edit form when selected node changes
  useEffect(() => {
    if (selectedNode) {
      setEditForm({
        content: selectedNode.content || '',
        summary: selectedNode.summary || '',
        source: selectedNode.source || '',
        memoryType: selectedNode.group || '',
        metadata: selectedNode.metadata ? JSON.stringify(selectedNode.metadata, null, 2) : ''
      });
    } else {
      setIsEditing(false);
    }
  }, [selectedNode]);

  const handleSave = async () => {
    if (!selectedNode) return;
    setIsSaving(true);
    
    try {
      let parsedMetadata = undefined;
      if (editForm.metadata && editForm.metadata.trim() !== '') {
        parsedMetadata = JSON.parse(editForm.metadata);
      }

      const payload = {
        content: editForm.content,
        summary: editForm.summary,
        source: editForm.source,
        memoryType: editForm.memoryType,
        metadata: parsedMetadata
      };

      const res = await fetch(`/api/memories/${selectedNode.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to update');
      
      const updatedMemory = await res.json();
      
      // Update local state to reflect changes instantly without full reload
      const updatedNodes = data.nodes.map((n: any) => {
        if (n.id === selectedNode.id) {
          return {
            ...n,
            content: updatedMemory.content,
            summary: updatedMemory.summary,
            name: updatedMemory.summary || (updatedMemory.content.length > 50 ? updatedMemory.content.substring(0, 50) + '...' : updatedMemory.content),
            source: updatedMemory.source,
            group: updatedMemory.memoryType,
            metadata: updatedMemory.metadata,
            updatedAt: updatedMemory.updatedAt
          };
        }
        return n;
      });
      
      setData({ ...data, nodes: updatedNodes as never[] });
      
      // Update selected node so the view refreshes
      setSelectedNode(updatedNodes.find((n: any) => n.id === selectedNode.id));
      setIsEditing(false);
      
    } catch (err) {
      alert('Error guardando los cambios. Verifica que la metadata sea un JSON válido.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        color: '#666',
        fontFamily: 'monospace'
      }}>
        Inicializando Orbis Knowledge Graph...
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: '#eee',
        zIndex: 10,
        pointerEvents: 'none',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(10px)',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 600 }}>Memory Heatmap</h1>
        <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>
          Visualizando {data.nodes.length} recuerdos.<br/>
          <span style={{ color: '#ff4d4d', fontWeight: 'bold' }}>Color (Rojo/Oro)</span>: Más consultados.<br/>
          <strong>Tamaño</strong>: Mayor cantidad de conexiones.
        </p>
      </div>
      
      <ForceGraph2D
        graphData={data}
        nodeLabel="name"
        nodeVal="val"
        backgroundColor="#0b0c0f"
        onNodeClick={setSelectedNode}
        onBackgroundClick={() => setSelectedNode(null)}
        // Animación de dirección (flujo de partículas)
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={d => (d.value || 1) * 0.003}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkColor={() => 'rgba(255, 255, 255, 0.08)'}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const label = node.name;
          const fontSize = 12 / globalScale;
          const radius = node.val || 2;
          
          // Escala de calor refinada
          const hue = 220 - (node.importance * 220); 
          const saturation = 60 + (node.importance * 40);
          const lightness = 45 + (node.importance * 25);
          
          // Resaltar si está seleccionado
          const isSelected = selectedNode && node.id === selectedNode.id;
          if (isSelected) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 20 / globalScale;
          } else {
            ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            if (node.importance > 0.4) {
              ctx.shadowColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
              ctx.shadowBlur = (5 + node.importance * 15) / globalScale;
            } else {
              ctx.shadowBlur = 0;
            }
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fill();

          // Solo dibujar texto si el zoom es suficiente, el nodo es MUY importante, o está seleccionado
          if (globalScale > 3 || node.importance > 0.7 || isSelected) {
            ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
            ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px system-ui, sans-serif`;
            ctx.fillText(label, node.x + radius + 3, node.y + fontSize / 2);
          }
        }}
      />

      {/* Panel Lateral de Detalles */}
      {selectedNode && (
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '400px',
          height: '100vh',
          overflowY: 'auto',
          color: '#eee',
          zIndex: 20,
          backgroundColor: 'rgba(15, 17, 26, 0.95)',
          backdropFilter: 'blur(16px)',
          padding: '32px 24px',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.5)',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {!isEditing ? (
                <span style={{ 
                  background: 'rgba(255,255,255,0.1)', 
                  padding: '4px 8px', 
                  borderRadius: '4px', 
                  fontSize: '0.75rem', 
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  width: 'fit-content'
                }}>
                  {selectedNode.group}
                </span>
              ) : (
                <select 
                  value={editForm.memoryType || ''}
                  onChange={e => setEditForm({...editForm, memoryType: e.target.value})}
                  style={{ background: '#333', color: '#fff', border: '1px solid #555', padding: '4px', borderRadius: '4px' }}
                >
                  <option value="EXPERIENCE">EXPERIENCE</option>
                  <option value="DECISION">DECISION</option>
                  <option value="FACT">FACT</option>
                  <option value="TASK">TASK</option>
                  <option value="WORLD">WORLD</option>
                </select>
              )}
              <span style={{ fontSize: '0.7rem', color: '#888', fontFamily: 'monospace' }}>
                ID: {selectedNode.id}
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {!isEditing ? (
                <button 
                  onClick={() => setIsEditing(true)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}
                >✏️ Editar</button>
              ) : (
                <>
                  <button 
                    onClick={() => setIsEditing(false)}
                    style={{ background: 'transparent', border: '1px solid #555', color: '#aaa', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}
                  >Cancelar</button>
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{ background: '#00f0ff', border: 'none', color: '#000', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}
                  >{isSaving ? 'Guardando...' : 'Guardar'}</button>
                </>
              )}
              <button 
                onClick={() => { setSelectedNode(null); setIsEditing(false); }}
                style={{
                  background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.5rem', padding: 0, lineHeight: 1
                }}
              >×</button>
            </div>
          </div>
          
          {!isEditing ? (
            <>
              <div style={{ fontSize: '1rem', lineHeight: 1.6, color: '#fff' }}>
                {selectedNode.content}
              </div>

              {selectedNode.summary && selectedNode.summary !== selectedNode.content && (
                <div style={{ fontSize: '0.85rem', color: '#aaa', fontStyle: 'italic', borderLeft: '2px solid #555', paddingLeft: '8px' }}>
                  {selectedNode.summary}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '0.75rem', color: '#888' }}>CONTENIDO</label>
              <textarea 
                value={editForm.content || ''}
                onChange={e => setEditForm({...editForm, content: e.target.value})}
                style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid #555', padding: '8px', borderRadius: '4px', minHeight: '100px', fontFamily: 'inherit', resize: 'vertical' }}
              />
              
              <label style={{ fontSize: '0.75rem', color: '#888' }}>RESUMEN (Opcional)</label>
              <textarea 
                value={editForm.summary || ''}
                onChange={e => setEditForm({...editForm, summary: e.target.value})}
                style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid #555', padding: '8px', borderRadius: '4px', minHeight: '60px', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
          )}

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '12px', 
            marginTop: '8px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            paddingTop: '16px'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>ORIGEN</div>
              {!isEditing ? (
                <div style={{ fontSize: '0.9rem' }}>{selectedNode.source}</div>
              ) : (
                <select 
                  value={editForm.source || ''}
                  onChange={e => setEditForm({...editForm, source: e.target.value})}
                  style={{ width: '100%', background: '#333', color: '#fff', border: '1px solid #555', padding: '4px', borderRadius: '4px' }}
                >
                  <option value="USER">USER</option>
                  <option value="AGENT">AGENT</option>
                  <option value="SYSTEM">SYSTEM</option>
                  <option value="GROUP">GROUP</option>
                </select>
              )}
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>CONSULTAS</div>
              <div style={{ fontSize: '0.9rem', color: '#ff4d4d', fontWeight: 'bold' }}>
                {selectedNode.accessCount}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>CREADO</div>
              <div style={{ fontSize: '0.85rem' }}>
                {new Date(selectedNode.createdAt).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>ACTUALIZADO</div>
              <div style={{ fontSize: '0.85rem' }}>
                {new Date(selectedNode.updatedAt).toLocaleString()}
              </div>
            </div>
            {selectedNode.lastAccessedAt && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>ÚLTIMO ACCESO</div>
                <div style={{ fontSize: '0.85rem' }}>
                  {new Date(selectedNode.lastAccessedAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {(!isEditing ? (
            selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px' }}>METADATA</div>
                <pre style={{ 
                  margin: 0, 
                  padding: '8px', 
                  backgroundColor: 'rgba(0,0,0,0.3)', 
                  borderRadius: '4px', 
                  fontSize: '0.75rem', 
                  overflowX: 'auto',
                  color: '#aaa'
                }}>
                  {JSON.stringify(selectedNode.metadata, null, 2)}
                </pre>
              </div>
            )
          ) : (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px' }}>METADATA (JSON format)</label>
              <textarea 
                value={editForm.metadata || ''}
                onChange={e => setEditForm({...editForm, metadata: e.target.value})}
                placeholder="{}"
                style={{ background: 'rgba(0,0,0,0.3)', color: '#00f0ff', border: '1px solid #555', padding: '8px', borderRadius: '4px', minHeight: '80px', fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
              />
            </div>
          ))}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>CONEXIONES ({selectedNode.connectionCount})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px', paddingBottom: '32px' }}>
              {data.links
                .filter((l: any) => l.source.id === selectedNode.id || l.target.id === selectedNode.id || l.source === selectedNode.id || l.target === selectedNode.id)
                .map((l: any, i) => {
                  const isSource = l.source.id === selectedNode.id || l.source === selectedNode.id;
                  const otherId = isSource ? (l.target.id || l.target) : (l.source.id || l.source);
                  const otherNode = data.nodes.find((n: any) => n.id === otherId);
                  const otherContent = otherNode ? (otherNode as any).content : 'Desconocido';
                  
                  return (
                    <div key={i} style={{ 
                      fontSize: '0.8rem', 
                      backgroundColor: 'rgba(255,255,255,0.05)', 
                      padding: '10px', 
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      border: '1px solid rgba(255,255,255,0.02)'
                    }}>
                      <div style={{ color: '#ccc', display: 'flex', alignItems: 'flex-start', gap: '8px', lineHeight: 1.4 }}>
                        <span style={{ fontSize: '1rem' }}>{isSource ? '➡️' : '⬅️'}</span> 
                        <span style={{ color: '#fff', fontWeight: 500 }}>{otherContent}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ color: '#666', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                          {otherId.substring(0, 8)}...
                        </span>
                        <span style={{ 
                          color: '#00f0ff', 
                          fontSize: '0.7rem', 
                          backgroundColor: 'rgba(0,240,255,0.1)', 
                          padding: '2px 6px', 
                          borderRadius: '4px',
                          fontWeight: 600
                        }}>
                          {l.relationType} ({l.value})
                        </span>
                      </div>
                    </div>
                  );
              })}
              {selectedNode.connectionCount === 0 && (
                <div style={{ fontSize: '0.8rem', color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>
                  Este recuerdo está aislado. No tiene conexiones.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
