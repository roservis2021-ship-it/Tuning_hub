import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked.map((config) => ({ ...config, files: ['src/features/premium/**/*.{ts,tsx}', 'vitest.config.ts'] })),
  ...tseslint.configs.stylisticTypeChecked.map((config) => ({ ...config, files: ['src/features/premium/**/*.{ts,tsx}', 'vitest.config.ts'] })),
  {
    files: ['src/features/premium/**/*.{ts,tsx}', 'vitest.config.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['server/services/stripe/**/*.mjs'],
    languageOptions: {
      globals: { Buffer: 'readonly' },
    },
  },
  {
    files: ['src/components/PaymentActivationScreen.jsx'],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { window: 'readonly' },
    },
  },
  {
    files: ['src/features/premium/{onboarding,garage}/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },
  {
    files: ['src/features/premium/auth/PostPaymentAccount.tsx'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
);
