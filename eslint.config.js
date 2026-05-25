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
  '.claude/**', // ✅ PR-G.3.11: agent prompts, hooks, one-off Firestore investigation scripts
  'functions/**', // ✅ Server-side code (Node.js) - different linting rules
  'scripts/**',   // ✅ Ad-hoc maintenance/migration scripts (Node.js, console output expected)
  '**/lib/**',    // ✅ Vendored third-party libraries (e.g. lucide.min.js)
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
  }],

  // PR-G.3.11: Ban `.toISOString().slice/substring/split(...)` — UTC date,
  // drifts at IL midnight + breaks for users abroad. Use TZ-safe helpers:
  //   frontend: `apps/user-app/js/modules/tz-helper.js` →
  //     todayInJerusalemYMD / dateToJerusalemYMD / dateTimeToJerusalemLocalInput
  //   backend: `functions/shared/calendar.js` →
  //     todayInJerusalemYMD / normalizeDateToYMD / startOfTodayInJerusalem
  // Severity = 'warn' INITIALLY — flips to 'error' in a follow-up PR after
  // the ~30 pre-existing violations across admin-panel + user-app are
  // cleaned up incrementally. Setting 'error' now would block CI on
  // unrelated PRs. The warning still surfaces the rule, prevents NEW
  // violations from going unnoticed in review, and lets `npx eslint
  // --max-warnings=0` enforce it locally for any developer who opts in.
  // Allowlist: tz-helper.js (the helper itself) — see overrides below.
  'no-restricted-syntax': ['warn', {
    selector: "CallExpression[callee.property.name=/^(slice|substring|split)$/][callee.object.type='CallExpression'][callee.object.callee.property.name='toISOString']",
    message: 'Use tz-helper (todayInJerusalemYMD / dateToJerusalemYMD / dateTimeToJerusalemLocalInput) instead of .toISOString().slice/substring/split — returns UTC, drifts at IL midnight. PR-G.3.7→G.3.11.'
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
      '.claude/**',
      'functions/**',
      'scripts/**'
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
        project: ['./tsconfig.json', './tests/tsconfig.json']
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
  },
  // PR-G.3.11: allowlist for tz-helper itself (defines the canonical
  // `Intl.DateTimeFormat` usage and may legitimately format Date objects).
  // Test files also exempt — they may intentionally exercise the old pattern
  // for regression coverage.
  {
    files: [
      'apps/user-app/js/modules/tz-helper.js',
      'tests/**/*.test.{js,ts}',
      'tests/**/*.spec.{js,ts}'
    ],
    rules: {
      'no-restricted-syntax': 'off'
    }
  }
];
