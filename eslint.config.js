import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';

const commonGlobals = {
  console: 'readonly',
  window: 'readonly',
  document: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  setInterval: 'readonly',
  clearTimeout: 'readonly',
  clearInterval: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
  firebase: 'readonly',
  EventBus: 'readonly',
  FirebaseService: 'readonly'
};

const commonIgnores = [
  'node_modules/**',
  'dist/**',
  'archive/**',
  'tools/**',
  'devtools/**',
  'docs/**',
  '.github/**',
  'functions/**', // ✅ Server-side code (Node.js) - different linting rules
  'vite.config.ts',
  'vitest.config.ts',
  'playwright.config.ts'
];

const commonJsRules = {
  // General JavaScript rules
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  'no-debugger': 'error',
  'no-alert': 'warn',
  'prefer-const': 'error',
  'no-var': 'error',
  'eqeqeq': ['error', 'always'],
  'curly': ['error', 'all'],
  'brace-style': ['error', '1tbs'],
  'semi': ['error', 'always'],
  'quotes': ['error', 'single', { avoidEscape: true }],
  'comma-dangle': ['error', 'never'],
  'arrow-spacing': 'error',
  'space-before-blocks': 'error',
  'keyword-spacing': 'error',
  'no-trailing-spaces': 'error',
  'no-multiple-empty-lines': ['error', { max: 2 }],
  'max-len': ['warn', {
    code: 120,
    ignoreComments: true,
    ignoreStrings: true,
    ignoreTemplateLiterals: true
  }]
};

export default [
  // Global ignores (applied to all files)
  {
    ignores: [
      'node_modules/**',
      '**/dist/**',
      'archive/**',
      'tools/**',
      'devtools/**',
      'docs/**',
      '.github/**',
      'functions/**'
    ]
  },
  // TypeScript files - with type checking
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: commonIgnores,
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json'
      },
      globals: commonGlobals
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'import': importPlugin
    },
    rules: {
      // TypeScript rules (high-tech standards)
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-imports': 'error',

      // Import rules (high-tech standards)
      'import/no-duplicates': 'error',
      'import/order': ['error', {
        'groups': [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index'
        ],
        'newlines-between': 'always',
        'alphabetize': {
          'order': 'asc',
          'caseInsensitive': true
        }
      }],

      ...commonJsRules
    }
  },
  // JavaScript files - without type checking
  {
    files: ['**/*.js'],
    ignores: commonIgnores,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: commonGlobals
    },
    plugins: {
      'import': importPlugin
    },
    rules: {
      // Import rules
      'import/no-duplicates': 'error',

      ...commonJsRules
    }
  }
];
