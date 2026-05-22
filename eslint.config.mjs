import nextPlugin from '@next/eslint-plugin-next';

export default [
  {
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    ignores: ['node_modules/**', '.next/**', 'dist-electron/**'],
  },
];
