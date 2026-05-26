import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const wrapperPath = path.resolve(process.cwd(), 'scripts/opencode-real-wrapper.sh');

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-wrapper-test-'));
}

describe('opencode-real-wrapper', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = null;
  });

  it('strips wrapper-only flags and preserves the live --format json contract for research-service', () => {
    tempDir = makeTempDir();
    const fakeOpencode = path.join(tempDir, 'opencode-fake.sh');
    const argsFile = path.join(tempDir, 'args.txt');
    const expectedJson = JSON.stringify({
      grants: [
        {
          id: 'mock-grant-001',
          title: 'Community Innovation Grant',
          funder: 'Mock Foundation',
          funderShort: 'Mock',
          award: '$50,000',
          awardSort: 50000,
          deadline: '2026-06-30',
          daysOut: 30,
          fit: 82,
          tags: ['Community', 'Technology'],
          status: 'matched',
          statusLabel: 'Matched',
          matchedAt: '2026-05-24T00:00:00.000Z',
        },
      ],
      evidence: [],
      rationale: 'Mock research completed successfully',
    });

    fs.writeFileSync(
      fakeOpencode,
      `#!/bin/sh
set -eu
printf '%s\n' "$*" > "$ARGS_FILE"
cat <<'EOF'
${expectedJson}
EOF
`,
      'utf8',
    );
    fs.chmodSync(fakeOpencode, 0o755);

    const output = execFileSync(
      'bash',
      [wrapperPath, 'run', '--format', 'json', 'Prompt text', '--profile', 'default'],
      {
        env: {
          ...process.env,
          OPENCODE_BIN: fakeOpencode,
          ARGS_FILE: argsFile,
        },
        encoding: 'utf8',
      },
    );

    expect(output.trim()).toBe(expectedJson);
    expect(fs.readFileSync(argsFile, 'utf8').trim()).toBe('run --format json Prompt text');
  });
});
