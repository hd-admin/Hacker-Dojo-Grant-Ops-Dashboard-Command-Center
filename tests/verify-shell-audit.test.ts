import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it, beforeAll } from 'vitest';

describe('verify.sh audit', () => {
  let repoRoot: string;
  let rgAvailable: boolean;

  beforeAll(() => {
    repoRoot = path.resolve(process.cwd());
    try {
      execFileSync('rg', ['--version'], { encoding: 'utf8' });
      rgAvailable = true;
    } catch {
      rgAvailable = false;
    }
  });

  it('has rg available for the audit', () => {
    expect(rgAvailable).toBe(true);
  });

  it('stays clean on the intended product surfaces', () => {
    if (!rgAvailable) {
      throw new Error('rg not available — cannot run audit');
    }

    let output: string;
    try {
      output = execFileSync(
        'bash',
        [
          '-lc',
          `cd ${JSON.stringify(repoRoot)} && AUDIT_NAME="$(printf '%s%s' ele ctron)"; AUDIT_PATTERN="(^|[^[:alnum:]])${'${AUDIT_NAME}'}([^[:alnum:]]|$)"; rg -n --hidden -i -P "$AUDIT_PATTERN" package.json frontend/package.json eslint.config.mjs frontend/next.config.ts playwright.config.ts scripts frontend/src tests -g '!**/node_modules/**' -g '!**/.next/**' -g '!**/playwright-report/**' -g '!**/test-results/**' -g '!**/.git/**'`,
        ],
        { encoding: 'utf8' },
      );
    } catch (err: unknown) {
      const childError = err as { status?: number; stderr?: string; stdout?: string };
      if (childError.status === 1) {
        // rg exit code 1 = no matches found (clean)
        expect(childError.stdout?.trim() ?? '').toBe('');
        return;
      }
      throw err;
    }

    // rg exit code 0 = matches found (dirty)
    expect(output.trim()).toBe('');
  });
});
