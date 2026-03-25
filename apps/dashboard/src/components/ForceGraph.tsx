'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export default function ForceGraph() {
  const [data, setData] = useState({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Fetch graph data
    const fetchData = async () => {
      try {
        const res = await fetch('/api/graph');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Error fetching graph:', err);
      }
    };

    fetchData();

    // Responsive dimensions
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions();

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  if (!data.nodes.length) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#111',
        color: '#eee',
        fontFamily: 'sans-serif'
      }}>
        Cargando grafo de conocimiento...
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#111' }}>
      <ForceGraph2D
        graphData={data}
        width={dimensions.width}
        height={dimensions.height}
        nodeLabel="name"
        nodeAutoColorBy="group"
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        backgroundColor="#111"
        linkColor={() => 'rgba(255, 255, 255, 0.2)'}
      />
    </div>
  );
}
