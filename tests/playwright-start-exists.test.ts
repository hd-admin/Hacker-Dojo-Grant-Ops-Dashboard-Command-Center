import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT_PATH = path.resolve(process.cwd(), 'playwright-start.sh');

describe('playwright-start.sh', () => {
  it('exists at the repository root', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
  });

  it('is executable (owner + group + other)', () => {
    const mode = statSync(SCRIPT_PATH).mode & 0o777;
    expect(mode & 0o111).toBeTruthy();
  });

  it('is the file Playwright invokes (references APP_BASE_URL)', () => {
    const content = readFileSync(SCRIPT_PATH, 'utf8');
    expect(content).toContain('APP_BASE_URL');
  });

  it('starts the dev server in the repo root (cd to $(dirname $0))', () => {
    const content = readFileSync(SCRIPT_PATH, 'utf8');
    expect(content).toMatch(/cd\s+"\$\(dirname\s+"\$0"\)"/);
  });
});
