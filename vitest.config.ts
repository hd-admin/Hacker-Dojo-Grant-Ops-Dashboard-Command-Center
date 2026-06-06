import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

export default defineConfig({
  test: {
    globals: true,
    include: [
      'tests/**/*.test.ts',
      'frontend/src/**/*.test.ts',
      'frontend/src/**/*.test.tsx',
      'shared/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.idea/**',
      '**/.git/**',
      '**/.cache/**',
    ],
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      TMPDIR: path.join(os.tmpdir(), 'vitest-hacker-dojo'),
      NODE_OPTIONS: '--max-old-space-size=4096',
    },
    setupFiles: [path.resolve(__dirname, './tests/vitest-setup.ts')],
    testTimeout: 30000,
    hookTimeout: 30000,

    // The 135+ test files share better-sqlite3 native state that
    // accumulates across files when run in a single process. Fork
    // isolation with singleFork:false creates a new fork for each test
    // file, and maxForks:1 limits concurrency to one file at a time.
    // This provides per-file process isolation within a single vitest
    // invocation. The standard `pnpm test` script additionally uses
    // run-test-batches.sh to split the suite into groups of 15 files,
    // each invoked as a separate vitest process, as an extra safeguard
    // against environmental process-duration limits.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: 1,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend/src'),
      react: require.resolve('next/dist/compiled/react'),
      'react/jsx-runtime': require.resolve('next/dist/compiled/react/jsx-runtime'),
      'react/jsx-dev-runtime': require.resolve('next/dist/compiled/react/jsx-dev-runtime'),
      'react-dom': require.resolve('next/dist/compiled/react-dom'),
      'react-dom/client': require.resolve('next/dist/compiled/react-dom/client'),
      'lucide-react': path.resolve(__dirname, './__mocks__/lucide-react.tsx'),
    },
  },
});
