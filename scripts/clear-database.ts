import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Housekeeping: wipe the local Grant Ops SQLite database and its document store.
 *
 * This is intentionally self-contained and does NOT import the `server-only`
 * persistence module (see scripts/print-grant-ops-data-dir.ts for the same
 * pattern). The app re-bootstraps and re-seeds an empty database automatically
 * on the next `npm run dev` / `npm run start`.
 */
function resolveDataDir(): string {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR);
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.grant-ops-data');
}

const dataDir = resolveDataDir();
const dbPath = path.join(dataDir, 'grant-ops.sqlite');

const removed: string[] = [];

function remove(target: string): void {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    removed.push(path.relative(process.cwd(), target));
  }
}

// SQLite database plus its write-ahead-log sidecars and any timestamped backups.
remove(dbPath);
remove(`${dbPath}-wal`);
remove(`${dbPath}-shm`);
remove(`${dbPath}-journal`);
if (fs.existsSync(dataDir)) {
  for (const entry of fs.readdirSync(dataDir)) {
    if (entry.startsWith('grant-ops.sqlite.backup-')) {
      remove(path.join(dataDir, entry));
    }
  }
}

// Uploaded / generated documents tied to the wiped database.
remove(path.join(dataDir, 'documents'));

if (removed.length === 0) {
  process.stdout.write(`Database already clear — nothing to remove in ${dataDir}\n`);
} else {
  process.stdout.write(`Cleared local database (${removed.length} item(s)):\n`);
  for (const item of removed) {
    process.stdout.write(`  - ${item}\n`);
  }
  process.stdout.write('A fresh, seeded database is created on the next `npm run dev`.\n');
}
