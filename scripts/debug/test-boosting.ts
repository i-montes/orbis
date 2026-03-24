import { Memor } from "../core/memor/src/index.js";

async function testBoosting() {
  const memor = new Memor();
  const query = "¿Cómo afecta el café a mi salud y productividad?";
  
  console.log(`🔍 Buscando: "${query}" con Graph Boosting...\n`);
  
  const results = await memor.search(query, { topK: 5, expandGraph: true });
  
  results.forEach((r, i) => {
    console.log(`${i + 1}. [Score: ${(r.score * 100).toFixed(1)}%]`);
    console.log(`   ${r.memory.content}\n`);
  });

  memor.close();
}

testBoosting().catch(console.error);
