import type { Database } from 'bun:sqlite';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { DatabaseError, createLogger } from '@orbis/shared';

const logger = createLogger('memor');

export function runMigrations(db: Database): void {
  // 1. Verifica si la tabla _migrations existe. Si no existe, la crea primero.
  const checkTable = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations';
  `).get();

  if (!checkTable) {
    db.exec(`
      CREATE TABLE _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL
      );
    `);
  }

  // 2. Lee todos los archivos .sql de la carpeta migrations/ ordenados por nombre
  // Usamos import.meta.dir (Bun) para obtener el directorio actual
  const migrationsDir = import.meta.dir;
  const files = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  let appliedCount = 0;

  const checkMigration = db.prepare('SELECT id FROM _migrations WHERE name = ?');
  const insertMigration = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');

  // 3 & 4 & 5. Para cada archivo, verifica si está registrado, si no ejecuta
  for (const file of files) {
    const isApplied = checkMigration.get(file);
    if (!isApplied) {
      const filePath = join(migrationsDir, file);
      const sql = readFileSync(filePath, 'utf-8');

      const applyMigration = db.transaction(() => {
        db.exec(sql);
        insertMigration.run(file, Date.now());
      });

      try {
        applyMigration();
        appliedCount++;
        logger.info(`Migration applied: ${file}`);
      } catch (error) {
        throw new DatabaseError(`Migration failed: ${file}`, 'MIGRATION_FAILED', error);
      }
    }
  }

  // 6. Log final
  if (appliedCount > 0) {
    logger.info(`Applied ${appliedCount} migrations successfully.`);
  } else {
    logger.info('Database schema is up to date. No pending migrations.');
  }
}
