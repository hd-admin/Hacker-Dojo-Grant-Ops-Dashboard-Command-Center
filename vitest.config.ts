import { createRequire } from 'node:module';
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
      TMPDIR: '/home/mistlight/tmp-vitest',
      NODE_OPTIONS: '--max-old-space-size=4096',
    },
    setupFiles: [path.resolve(__dirname, './tests/vitest-setup.ts')],
    testTimeout: 30000,
    hookTimeout: 30000,

    // The 135+ test files share better-sqlite3 native state that
    // accumulates across files when run in a single process. Fork
    // isolation with singleFork:false and maxForks:1 reuses the same
    // fork worker for all files, so native memory growth still OOMs.
    // The reliable fix is external batching: run-test-batches.sh
    // splits the suite into groups of 15 and invokes vitest separately
    // for each group, guaranteeing a completely fresh Node process per
    // batch. The standard `pnpm test` script is wired to that wrapper.
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
