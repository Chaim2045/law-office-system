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
  'playwright.config.ts',
  // PR #347: vitest.rules.config.ts (added in PR #343) is a root tool-config like
  // the three above, but was never added to this ignore list. When PR #347
  // excluded "*.config.ts" from tsconfig.json, the typed ESLint parser
  // (parserOptions.project) could no longer resolve it → a "file was not found in
  // any of the provided project(s)" parse ERROR that failed CI lint. Ignoring it
  // here matches its siblings (tooling, not shipped code) and keeps ESLint and
  // tsconfig consistent (both now exclude the root *.config.ts files).
  'vitest.rules.config.ts'
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
  // drifts at IL midnight + breaks for users abroad. Use TZ-safe helpers.
  //
  // PR-2.1.1 (2026-05-26): Ban inline service-type classification:
  //   `svc.type === 'fixed' | 'hours' | 'legal_procedure'`
  //   `svc.pricingType === 'fixed' | 'hourly'`
  // Use the canonical predicates from shared/business-rules/service-classification.js
  // (mirror at functions/shared/business-rules/ for backend, window.BUSINESS_RULES
  // for browser).
  //
  // Severity = 'warn' INITIALLY — there are 61 pre-existing inline-classification
  // sites mapped in PR-2.1.1 investigation; they migrate in PR-2.1.2. Setting
  // 'error' now would block CI on unrelated PRs. Warning surfaces new violations
  // in review.
  //
  // Allowlist: see overrides block at the bottom of this config.
  'no-restricted-syntax': ['warn',
    {
      selector: "CallExpression[callee.property.name=/^(slice|substring|split)$/][callee.object.type='CallExpression'][callee.object.callee.property.name='toISOString']",
      message: 'Use tz-helper (todayInJerusalemYMD / dateToJerusalemYMD / dateTimeToJerusalemLocalInput) instead of .toISOString().slice/substring/split — returns UTC, drifts at IL midnight. PR-G.3.7→G.3.11.'
    },
    {
      selector: "BinaryExpression[operator='==='][left.type='MemberExpression'][left.property.name=/^(type|pricingType)$/][right.type='Literal'][right.value=/^(fixed|hours|hourly|legal_procedure)$/]",
      message: "Inline service-type classification is banned. Use shared/business-rules/service-classification.js predicates (isFixedService / isHourlyService / isLegalProcedureService) — in browser via window.BUSINESS_RULES, in functions via require('./business-rules/service-classification'). PR-2.1.1."
    },
    {
      selector: "BinaryExpression[operator='==='][right.type='MemberExpression'][right.property.name=/^(type|pricingType)$/][left.type='Literal'][left.value=/^(fixed|hours|hourly|legal_procedure)$/]",
      message: 'Inline service-type classification is banned (reversed comparison). Use shared/business-rules/service-classification.js predicates. PR-2.1.1.'
    }
  ]
};

export default [
  // Global ignores (applied to all files).
  // PR-2.1.1 (2026-05-26): removed 'functions/**' + 'scripts/**' from global
  // ignores so the Node-targeted block at the bottom can lint them with the
  // service-classification ban. They REMAIN in `commonIgnores` so the standard
  // TS/JS rule cascade still skips them — avoiding a thousand pre-existing
  // backend lint errors landing in this PR.
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
      // PR-Pre-H.0.0.B: TypeScript declaration files (.d.ts) are pure type
      // metadata — no runtime code to lint. Including them in the parsed
      // project surface broke ESLint when the build tsconfig excluded them.
      '**/*.d.ts'
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
  // PR-G.3.11 / PR-2.1.1: allowlist for canonical helpers + tests.
  //   - tz-helper.js: canonical TZ implementation; may use Intl.DateTimeFormat.
  //   - business-rules-adapter.js / service-classification.js: canonical
  //     service-classification module; defines the predicates that all other
  //     code must use, so it legitimately contains inline type comparisons.
  //   - tests: may intentionally exercise old patterns for regression coverage.
  {
    files: [
      'apps/user-app/js/modules/tz-helper.js',
      'apps/admin-panel/js/shared/business-rules-adapter.js',
      'apps/user-app/js/shared/business-rules-adapter.js',
      'shared/business-rules/**',
      'tests/**/*.test.{js,ts}',
      'tests/**/*.spec.{js,ts}'
    ],
    rules: {
      'no-restricted-syntax': 'off'
    }
  },
  // PR-2.1.1: Node-targeted block for backend lint of service-classification ban.
  // Standard JS/TS rules (commonIgnores) still skip functions/** + scripts/**,
  // so this block applies ONLY the service-classification restricted-syntax —
  // no cascade of style errors from pre-existing backend code.
  // Canonical module + tests inside functions/ are exempted via the second block below.
  {
    files: ['functions/**/*.js', 'scripts/**/*.js'],
    ignores: [
      'functions/node_modules/**',
      'functions/lib/**'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      // sourceType: 'module' accepts both CommonJS (require/module.exports) and
      // ES modules (import/export) — needed because some files in functions/src/
      // use ES modules (e.g. functions/src/modules/deduction/{aggregators,calculators,validators}.js).
      sourceType: 'module',
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly'
      }
    },
    rules: {
      'no-restricted-syntax': ['warn',
        {
          selector: "BinaryExpression[operator='==='][left.type='MemberExpression'][left.property.name=/^(type|pricingType)$/][right.type='Literal'][right.value=/^(fixed|hours|hourly|legal_procedure)$/]",
          message: "Inline service-type classification is banned in backend code. Use require('./business-rules/service-classification') predicates (isFixedService / isHourlyService / isLegalProcedureService). The canonical lives at shared/business-rules/, mirrored in functions/shared/business-rules/ for deploy. PR-2.1.1."
        },
        {
          selector: "BinaryExpression[operator='==='][right.type='MemberExpression'][right.property.name=/^(type|pricingType)$/][left.type='Literal'][left.value=/^(fixed|hours|hourly|legal_procedure)$/]",
          message: 'Inline service-type classification is banned (reversed comparison). Use shared service-classification predicates. PR-2.1.1.'
        }
      ]
    }
  },
  // PR-2.1.1: exempt the canonical functions/ mirror + functions tests.
  {
    files: [
      'functions/shared/business-rules/**',
      'functions/tests/**/*.js',
      'functions/tests/**/*.test.js'
    ],
    rules: {
      'no-restricted-syntax': 'off'
    }
  },
  // ───────────────────────────────────────────────────────────────────────────
  // PR-META-6 (Engineering Bar Elevation): NEW TypeScript code under
  // functions/src-ts/ gets STRICT linting. Existing JS in functions/ is
  // unaffected — commonIgnores at the top still applies to all the other
  // blocks. This block explicitly opts INTO linting for src-ts/ only.
  //
  // Policy from META-6 checkpoint:
  //   - 0 errors enforced (CI blocks merge)
  //   - warnings allowed but counted in PR summary (devils-advocate #5 defense:
  //     "0 warnings forces // @ts-ignore culture" — we don't want that)
  //   - console.* is FORBIDDEN — use require('../shared/logger') shim
  //   - any in-file is a warning, not error (occasional `any` for migration
  //     glue is acceptable; weekly review trims them)
  // ───────────────────────────────────────────────────────────────────────────
  {
    files: ['functions/src-ts/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        // Use the ESLint-only tsconfig that re-includes __tests__ — the build
        // tsconfig.json excludes tests so they don't land in functions/lib/.
        project: ['./functions/src-ts/tsconfig.eslint.json']
      },
      globals: {
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        console: 'readonly', // Available globally; usage forbidden via no-restricted-syntax below
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'import': importPlugin
    },
    rules: {
      // === Type safety — strict (errors block CI) ===
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // === Migration-friendly warnings (visible in PR summary, don't block) ===
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // === Logger discipline — forbid console.*, force shim ===
      'no-restricted-syntax': ['error',
        {
          selector: "CallExpression[callee.object.name='console']",
          message: "Use require('../shared/logger') instead of console.* — structured logging is required for new code (PR-META-6). console.log is silenced by Cloud Logging anyway."
        }
      ],

      // === Import hygiene ===
      'import/no-duplicates': 'error',

      // === Common rules (semi, quotes, prefer-const, etc.) ===
      // We intentionally do NOT spread commonJsRules here — commonJsRules
      // contains the PR-G.3.11 toISOString ban that targets browser code, and
      // the PR-2.1.1 inline service-classification ban that the Node-targeted
      // block already handles for functions/. Apply only the syntax rules:
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'comma-dangle': ['error', 'never'],
      'no-trailing-spaces': 'error'
    }
  }
];
