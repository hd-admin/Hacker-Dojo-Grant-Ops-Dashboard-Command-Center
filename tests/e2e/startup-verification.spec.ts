import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

test.describe('Startup verification', () => {
  test('pnpm setup:check exits 0', () => {
    const result = execSync('pnpm setup:check', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    expect(result).toContain('local setup verified');
  });

  test('better-sqlite3 loads and can execute a query', () => {
    const result = execSync(
      'node -e "const db=require(\'better-sqlite3\')(\':memory:\');console.log(db.prepare(\'select 1 as n\').get().n);db.close();"',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    expect(result.trim()).toBe('1');
  });

  test('.grant-ops-data/ directory is writable', () => {
    const dataDir = join(process.cwd(), '.grant-ops-data');
    expect(existsSync(dataDir)).toBe(true);
    // Verify write access by touching a test file
    const testFile = join(dataDir, '.write-test');
    try {
      const fs = require('fs');
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
    } catch (_err) {
      throw new Error('.grant-ops-data/ is not writable');
    }
  });

  test('Node.js version is >= 20.0.0', () => {
    const version = process.versions.node;
    const [major] = version.split('.').map(Number);
    expect(major).toBeGreaterThanOrEqual(20);
  });
});
