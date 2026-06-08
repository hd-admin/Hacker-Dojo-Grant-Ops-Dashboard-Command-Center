import { spawn, spawnSync } from 'node:child_process';

export interface AbiGuardResult {
  ok: boolean;
  rebuilt: boolean;
  message: string;
  stderr?: string;
}

function nodeBin(): string {
  return process.execPath;
}

function packageManager(): 'pnpm' | 'npm' {
  const has = spawnSync('pnpm', ['--version'], { stdio: 'pipe' });
  if (has.status === 0) return 'pnpm';
  return 'npm';
}

export function runRequireBetterSqlite3(): { ok: boolean; stderr: string; stdout: string } {
  const result = spawnSync(
    nodeBin(),
    ['-e', "require('better-sqlite3'); console.log('node-abi: ok');"],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    },
  );
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function rebuildBetterSqlite3(): { ok: boolean; stderr: string; stdout: string } {
  const pm = packageManager();
  const result = spawnSync(pm, ['rebuild', 'better-sqlite3'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export async function assertBetterSqlite3Loads(): Promise<AbiGuardResult> {
  const initial = runRequireBetterSqlite3();
  if (initial.ok) {
    return { ok: true, rebuilt: false, message: 'node-abi: ok', stderr: initial.stderr };
  }

  const rebuild = rebuildBetterSqlite3();
  if (!rebuild.ok) {
    return {
      ok: false,
      rebuilt: true,
      message: `better-sqlite3 rebuild failed: ${rebuild.stderr || rebuild.stdout}`,
      stderr: initial.stderr,
    };
  }

  const after = runRequireBetterSqlite3();
  if (after.ok) {
    return {
      ok: true,
      rebuilt: true,
      message: 'node-abi: ok (after rebuild)',
      stderr: after.stderr,
    };
  }

  return {
    ok: false,
    rebuilt: true,
    message: `better-sqlite3 still fails to load after rebuild: ${after.stderr}`,
    stderr: after.stderr || initial.stderr,
  };
}

export async function waitForChildReady(
  child: ReturnType<typeof spawn>,
  timeoutMs: number,
  readyRegex: RegExp = /ready/i,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`dev server did not become ready within ${timeoutMs}ms`));
    }, timeoutMs);
    const onChunk = (chunk: Buffer) => {
      if (readyRegex.test(chunk.toString('utf8'))) {
        clearTimeout(timer);
        child.stdout?.off('data', onChunk);
        child.stderr?.off('data', onChunk);
        resolve();
      }
    };
    child.stdout?.on('data', onChunk);
    child.stderr?.on('data', onChunk);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`child process exited with code ${code} before becoming ready`));
    });
  });
}
