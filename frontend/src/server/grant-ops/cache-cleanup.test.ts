import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupTmpDir } from './cache-cleanup';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('cache-cleanup', () => {
  let dataDir: string;
  let tmpDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-'));
    tmpDir = path.join(dataDir, 'tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    vi.stubGlobal('console', { log: vi.fn(), error: vi.fn() });
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it('deletes old json files', () => {
    const oldFile = path.join(tmpDir, 'old.json');
    fs.writeFileSync(oldFile, '{}');
    const stat = fs.statSync(oldFile);
    fs.utimesSync(oldFile, stat.atime, new Date(Date.now() - 25 * 60 * 60 * 1000));

    cleanupTmpDir(dataDir);
    expect(fs.existsSync(oldFile)).toBe(false);
  });

  it('preserves recent files', () => {
    const newFile = path.join(tmpDir, 'new.json');
    fs.writeFileSync(newFile, '{}');

    cleanupTmpDir(dataDir);
    expect(fs.existsSync(newFile)).toBe(true);
  });
});
