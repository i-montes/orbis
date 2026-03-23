import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

/**
 * Finds the project root by looking for 'orbis.config.schema.json'
 * starting from the current directory and moving up.
 */
export function findProjectRoot(): string {
  let current = process.cwd();
  
  // Safety limit to avoid infinite loops if the file is missing
  const rootDir = dirname(current).split(/[\\\/]/)[0] || '';

  while (current && current !== rootDir) {
    if (existsSync(join(current, 'orbis.config.schema.json'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // Fallback to process.cwd() if not found
  return process.cwd();
}
