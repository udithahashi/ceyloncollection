import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'storage/**',
    'next-env.d.ts',
  ]),

  ...nextVitals,
  ...nextTs,

  {
    // Type-aware rules, scoped to application source so linting stays fast and
    // does not try to type-check standalone .mjs scripts.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The single most valuable typed rule in a database-backed app: catches a
      // forgotten `await` on a query or a Server Action, which otherwise fails
      // silently and intermittently.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'warn',

      // Use the pino logger instead, so output is structured and secrets are
      // redacted. console.warn/error stay allowed for genuine last-resort paths.
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-restricted-syntax': [
        'error',
        {
          // Environment variables must go through the validated `env` object in
          // src/lib/env so that a missing value fails loudly at startup rather
          // than becoming `undefined` deep inside a request.
          //
          // Two exceptions are allowed. NEXT_PUBLIC_* is inlined at build time
          // and is meant to be read directly. NEXT_RUNTIME is set by Next.js to
          // identify the runtime, and has to be readable before the env module
          // is imported - that check is what keeps the Node-only env module out
          // of the Edge runtime in the first place.
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env']:not([property.name=/^NEXT_(PUBLIC_|RUNTIME$)/])",
          message:
            'Do not read process.env directly. Import { env } from "@/lib/env" so the value is validated at startup.',
        },
      ],
    },
  },

  {
    // The env module is the one place allowed to read process.env, since that is
    // precisely its job.
    files: ['src/lib/env/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  {
    // proxy.ts runs in front of the app rather than inside it, and the Next.js
    // documentation is explicit that it must not depend on shared modules. Reading
    // the inlined NODE_ENV constant is the documented way to vary the CSP between
    // development and production without importing the env module.
    files: ['src/proxy.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  {
    files: ['scripts/**/*.mjs', '*.config.mjs', '*.config.ts'],
    rules: { 'no-console': 'off', 'no-restricted-syntax': 'off' },
  },

  // Must stay last: switches off every stylistic rule that would fight Prettier.
  prettier,
]);

export default eslintConfig;
