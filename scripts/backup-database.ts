import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Housekeeping: snapshot the local Grant Ops SQLite database to a timestamped
 * copy alongside it. Self-contained (no `server-only` imports) like the other
 * scripts/*.ts helpers.
 */
function resolveDataDir(): string {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR);
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.grant-ops-data');
}

const dataDir = resolveDataDir();
const dbPath = path.join(dataDir, 'grant-ops.sqlite');

if (!fs.existsSync(dbPath)) {
  process.stdout.write(`No database to back up at ${dbPath}\n`);
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = `${dbPath}.backup-${stamp}`;
fs.copyFileSync(dbPath, backupPath);

process.stdout.write(`Backed up database to ${path.relative(process.cwd(), backupPath)}\n`);
