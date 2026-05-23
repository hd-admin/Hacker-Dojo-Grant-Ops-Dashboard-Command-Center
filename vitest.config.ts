import { createRequire } from 'node:module';
import path from 'path';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts', 'frontend/src/**/*.test.ts', 'frontend/src/**/*.test.tsx', 'shared/**/*.test.ts'],
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend/src'),
      react: require.resolve('next/dist/compiled/react'),
      'react/jsx-runtime': require.resolve('next/dist/compiled/react/jsx-runtime'),
      'react/jsx-dev-runtime': require.resolve('next/dist/compiled/react/jsx-dev-runtime'),
      'react-dom': require.resolve('next/dist/compiled/react-dom'),
      'react-dom/client': require.resolve('next/dist/compiled/react-dom/client'),
    },
  },
});
