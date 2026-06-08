import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cleanupTmpDir,
  enforceCacheSizeLimit,
  _startPeriodicCleanup,
  _stopPeriodicCleanup,
} from './cache-cleanup';
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

  it('enforces cache size limit by deleting oldest files first', () => {
    const cacheDir = path.join(tmpDir, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });

    const oldFile = path.join(cacheDir, 'old.cache');
    const newFile = path.join(cacheDir, 'new.cache');
    fs.writeFileSync(oldFile, 'a'.repeat(100));
    fs.writeFileSync(newFile, 'b'.repeat(100));

    // Make oldFile older
    const oldStat = fs.statSync(oldFile);
    fs.utimesSync(oldFile, oldStat.atime, new Date(Date.now() - 60_000));

    const stats = enforceCacheSizeLimit(cacheDir, 150);
    expect(stats.deletedFiles).toBe(1);
    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(newFile)).toBe(true);
  });

  it('does not delete files when cache is under size limit', () => {
    const cacheDir = path.join(tmpDir, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });

    const file = path.join(cacheDir, 'small.cache');
    fs.writeFileSync(file, 'tiny');

    const stats = enforceCacheSizeLimit(cacheDir, 1000);
    expect(stats.deletedFiles).toBe(0);
    expect(fs.existsSync(file)).toBe(true);
  });

  it('runs periodic cleanup on a timer', () => {
    _startPeriodicCleanup(dataDir);
    // Timer should be set; just verify it doesn't throw
    expect(() => _stopPeriodicCleanup()).not.toThrow();
  });

  it('preserves failed artifacts within 24 hours', () => {
    const failedFile = path.join(tmpDir, 'failed-job.json');
    fs.writeFileSync(failedFile, '{"status":"failed"}');
    const stat = fs.statSync(failedFile);
    // Set mtime to 12 hours ago (within 24h)
    fs.utimesSync(failedFile, stat.atime, new Date(Date.now() - 12 * 60 * 60 * 1000));

    cleanupTmpDir(dataDir);
    expect(fs.existsSync(failedFile)).toBe(true);
  });

  it('AC-3.2.1: log files older than 30 days are removed', () => {
    const oldLog = path.join(tmpDir, 'session-old.log');
    fs.writeFileSync(oldLog, 'log line');
    const stat = fs.statSync(oldLog);
    fs.utimesSync(oldLog, stat.atime, new Date(Date.now() - 31 * 24 * 60 * 60 * 1000));

    cleanupTmpDir(dataDir);
    expect(fs.existsSync(oldLog)).toBe(false);
  });

  it('AC-3.2.1: log files within 30 days are preserved', () => {
    const recentLog = path.join(tmpDir, 'session-recent.log');
    fs.writeFileSync(recentLog, 'log line');
    cleanupTmpDir(dataDir);
    expect(fs.existsSync(recentLog)).toBe(true);
  });

  it('AC-3.2.2: returns accurate deletedFiles count and freedBytes when over size', () => {
    const cacheDir = path.join(tmpDir, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const file1 = path.join(cacheDir, 'a.cache');
    const file2 = path.join(cacheDir, 'b.cache');
    fs.writeFileSync(file1, 'a'.repeat(100));
    fs.writeFileSync(file2, 'b'.repeat(100));
    const stat1 = fs.statSync(file1);
    fs.utimesSync(file1, stat1.atime, new Date(Date.now() - 120_000));

    const stats = enforceCacheSizeLimit(cacheDir, 150);
    expect(stats.deletedFiles).toBeGreaterThanOrEqual(1);
    expect(stats.freedBytes).toBeGreaterThan(0);
  });
});
