import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');
const FRONTEND_SRC = resolve(REPO_ROOT, 'frontend', 'src');

const SKIP_DIRECTORIES = new Set(['node_modules', '.next', 'dist', 'coverage']);

// A whole line that is *only* a use-client directive, in any of these shapes:
//   'use client';      "use client"      ('use client');     ( "use client" )
// Anchored to the whole line so comments (// 'use client') and embedded
// string usages (const x = 'use client') never match.
const DIRECTIVE_LINE = /^\s*(\(\s*)?(['"])use client\2(\s*\))?\s*;?\s*$/;
const PARENTHESIZED = /^\s*\(\s*(['"])use client\1\s*\)\s*;?\s*$/;

async function listSourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) stack.push(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push(full);
      }
    }
  }
  return out;
}

// Index of the first line that is real code: skips blank lines, `//` line
// comments, and `/* ... */` block comments at the top of the file.
function firstSignificantLine(lines: string[]): number {
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (inBlock) {
      if (line.includes('*/')) inBlock = false;
      continue;
    }
    if (line === '') continue;
    if (line.startsWith('//')) continue;
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlock = true;
      continue;
    }
    return i;
  }
  return -1;
}

describe('"use client" directive placement', () => {
  it('every directive is a bare top-of-file statement (never parenthesized, never after an import)', async () => {
    const files = await listSourceFiles(FRONTEND_SRC);
    const offenders: string[] = [];

    for (const file of files) {
      const lines = (await readFile(file, 'utf8')).split('\n');
      const directiveIdx = lines.findIndex((l) => DIRECTIVE_LINE.test(l));
      if (directiveIdx === -1) continue; // file has no use-client directive

      const rel = file.slice(REPO_ROOT.length + 1);

      if (PARENTHESIZED.test(lines[directiveIdx])) {
        offenders.push(
          `${rel}:${directiveIdx + 1} — directive is parenthesized "('use client')", which Next treats as a plain expression, not a directive`,
        );
        continue;
      }

      const firstCode = firstSignificantLine(lines);
      if (directiveIdx !== firstCode) {
        offenders.push(
          `${rel}:${directiveIdx + 1} — directive must be the first statement, but line ${firstCode + 1} (${lines[firstCode]?.trim()}) comes first`,
        );
      }
    }

    expect(
      offenders,
      `"use client" must be the first statement of the file and unparenthesized. ` +
        `Next.js only enforces this in the bundler — jsdom unit tests treat the directive as a no-op string, ` +
        `so a broken directive passes every render test and only fails at \`next build\`/\`next dev\`. Offenders:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });
});
