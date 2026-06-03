import { mkdirSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  getSqliteState,
  clearDatabase,
  resetSqliteCache,
} from '../shared/grant-ops-sqlite';

function getTempDir(): string {
  return process.env.TMPDIR ?? '/tmp/vitest';
}

let currentDataDir: string | null = null;

export function createTestDataDir(): string {
  const tempDir = getTempDir();
  const uniqueName = `vitest-db-${randomUUID()}`;
  const dataDir = path.join(tempDir, uniqueName);
  mkdirSync(dataDir, { recursive: true });
  const documentsDir = path.join(dataDir, 'documents');
  mkdirSync(documentsDir, { recursive: true });
  process.env.DATA_DIR = dataDir;
  currentDataDir = dataDir;
  return dataDir;
}

export async function cleanupTestDataDir(): Promise<void> {
  if (!currentDataDir) return;
  const dir = currentDataDir;
  currentDataDir = null;
  try {
    resetSqliteCache(dir);
    const state = getSqliteState(dir);
    await clearDatabase(state);
  } catch {
    // best effort cleanup
  }
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
}

export function getCurrentTestDataDir(): string | null {
  return currentDataDir;
}
