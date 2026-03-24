import { readdirSync, unlinkSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const testDir = join(process.cwd(), 'core/memor/tests');

console.log('\n[Cleanup] Cleaning up test databases...');

if (existsSync(testDir)) {
  const files = readdirSync(testDir);
  let count = 0;
  for (const file of files) {
    if (file.includes('.db')) {
      try {
        unlinkSync(join(testDir, file));
        count++;
      } catch (e) {
        // Silently skip if still locked, though after process exit it shouldn't be
      }
    }
  }
  
  const tmpData = join(testDir, 'tmp-data');
  if (existsSync(tmpData)) {
    try {
      rmSync(tmpData, { recursive: true, force: true });
      count++;
    } catch (e) {}
  }

  console.log(`[Cleanup] Removed ${count} temporary test files/folders.`);
}
