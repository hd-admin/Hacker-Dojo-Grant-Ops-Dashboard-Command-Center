import { mkdirSync, rmSync } from 'node:fs';
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
let suiteDataDir: string | null = null;

export function createSuiteDataDir(): string {
  const tempDir = getTempDir();
  suiteDataDir = path.join(tempDir, `vitest-db-${Date.now()}`);
  mkdirSync(suiteDataDir, { recursive: true });
  const documentsDir = path.join(suiteDataDir, 'documents');
  mkdirSync(documentsDir, { recursive: true });
  process.env.DATA_DIR = suiteDataDir;
  currentDataDir = suiteDataDir;
  return suiteDataDir;
}

export function createTestDataDir(): string {
  const dataDir = suiteDataDir ?? process.env.DATA_DIR;
  if (!dataDir) {
    return createSuiteDataDir();
  }
  mkdirSync(dataDir, { recursive: true });
  const documentsDir = path.join(dataDir, 'documents');
  mkdirSync(documentsDir, { recursive: true });
  process.env.DATA_DIR = dataDir;
  currentDataDir = dataDir;
  return dataDir;
}

export async function cleanupTestDataDir(): Promise<void> {
  const dir = currentDataDir;
  if (!dir) return;
  try {
    resetSqliteCache(dir);
    const state = getSqliteState(dir);
    await clearDatabase(state);
    await new Promise((resolve) => setTimeout(resolve, 100));
  } catch {
    // best effort cleanup
  }
}

export async function cleanupSuiteDataDir(): Promise<void> {
  if (!suiteDataDir) return;
  const dir = suiteDataDir;
  suiteDataDir = null;
  currentDataDir = null;
  try {
    resetSqliteCache(dir);
    const state = getSqliteState(dir);
    await clearDatabase(state);
    await new Promise((resolve) => setTimeout(resolve, 100));
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

export {
  getSqliteState,
  clearDatabase,
  resetSqliteCache,
};
