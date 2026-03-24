import { Database } from 'bun:sqlite';
import { join } from 'path';

const dbPath = join(process.cwd(), 'data/memor.db');
const db = new Database(dbPath);

const query = `
  SELECT relation_type, COUNT(*) as total, AVG(weight) as avg_weight 
  FROM edges 
  GROUP BY relation_type;
`;

console.log("📊 Densidad del Grafo de Orbis:");
const results = db.query(query).all();
console.table(results);
db.close();
