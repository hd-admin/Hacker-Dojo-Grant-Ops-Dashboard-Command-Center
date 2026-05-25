import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('verify.sh audit', () => {
  it('stays clean on the intended product surfaces', () => {
    const repoRoot = path.resolve(process.cwd());
    const output = execFileSync(
      'bash',
      [
        '-lc',
        `cd ${JSON.stringify(repoRoot)} && AUDIT_NAME="$(printf '%s%s' ele ctron)"; AUDIT_PATTERN="(^|[^[:alnum:]])${'${AUDIT_NAME}'}([^[:alnum:]]|$)"; rg -n --hidden -i -P "$AUDIT_PATTERN" package.json frontend/package.json eslint.config.mjs frontend/next.config.ts playwright.config.ts scripts frontend/src tests -g '!**/node_modules/**' -g '!**/.next/**' -g '!**/playwright-report/**' -g '!**/test-results/**' -g '!**/.git/**' || true`,
      ],
      { encoding: 'utf8' },
    );

    expect(output.trim()).toBe('');
  });
});