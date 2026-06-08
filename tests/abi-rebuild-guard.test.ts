import { describe, it, expect } from 'vitest';
import { assertBetterSqlite3Loads } from './helpers/abi-guard';

describe('better-sqlite3 ABI rebuild guard', () => {
  it('node -e "require(\'better-sqlite3\')" loads against the current Node ABI', async () => {
    const result = await assertBetterSqlite3Loads();
    if (!result.ok) {
      throw new Error(
        `better-sqlite3 cannot be loaded even after rebuild. Original error: ${result.stderr ?? '(no stderr)'}`,
      );
    }
    // The guard writes either "node-abi: ok" or "node-abi: ok (after rebuild)".
    // Tests assert the ok flag; the message is logged for visibility.
    expect(result.ok).toBe(true);
  }, 120_000);
});
