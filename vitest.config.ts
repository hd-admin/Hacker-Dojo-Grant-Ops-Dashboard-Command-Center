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
    env: { NODE_ENV: 'test', TMPDIR: '/home/mistlight/tmp-vitest' },
    setupFiles: [path.resolve(__dirname, './tests/vitest-setup.ts')],
    testTimeout: 30000,
    hookTimeout: 30000,

    // Use forks with singleFork and fileParallelism:false to ensure each
    // test file runs sequentially in a fresh process. This prevents
    // better-sqlite3 native memory growth from accumulating across the
    // 184+ test files, which was the root cause of OOM kills.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
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
