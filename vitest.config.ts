import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts', 'frontend/src/**/*.test.ts', 'frontend/src/**/*.test.tsx', 'shared/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, './tests/vitest-setup.ts')],
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
