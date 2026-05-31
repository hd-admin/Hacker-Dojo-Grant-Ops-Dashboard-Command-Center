import { describe, it, expect } from 'vitest';
import { detectCloudSync } from './cloud-sync-detector';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('cloud-sync-detector', () => {
  it('detects no cloud sync in temp dir', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-test-'));
    const result = detectCloudSync(tmpDir);
    expect(result.isCloudSynced).toBe(false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects Dropbox', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-test-'));
    fs.mkdirSync(path.join(tmpDir, '.dropbox'));
    const result = detectCloudSync(tmpDir);
    expect(result.isCloudSynced).toBe(true);
    expect(result.service).toBe('Dropbox');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
