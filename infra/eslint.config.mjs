import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: ['cdk.out/', 'dist/', 'node_modules/', 'coverage/', 'test/*.d.ts'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-new': 'off', // CDK constraint constructs
      '@typescript-eslint/no-floating-promises': 'warn',
    },
  },
  {
    files: ['eslint.config.mjs', 'jest.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
