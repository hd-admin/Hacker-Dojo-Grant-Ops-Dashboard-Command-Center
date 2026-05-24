import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(process.cwd());
const ensureScript = path.join(repoRoot, 'scripts', 'ensure-better-sqlite3.sh');

function canLoadBetterSqlite3(): boolean {
  try {
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    const db = new Database(':memory:');
    db.prepare('select 1').get();
    db.close();
    return true;
  } catch {
    return false;
  }
}

if (!canLoadBetterSqlite3()) {
  execFileSync('bash', [ensureScript], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (!canLoadBetterSqlite3()) {
    throw new Error('better-sqlite3 is still unavailable after rebuild');
  }
}
