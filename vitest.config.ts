import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.config.ts',
        '**/*.config.js',
        'archive/**',
        'tools/**',
        'docs/**',
        '.github/**'
      ],
      // High-tech company standards: 60%+ coverage
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60
      }
    },
    // tests/rules/ is INTENTIONALLY excluded from the default include — those
    // tests require a running Firestore Emulator (HARD GUARD in
    // tests/rules/setup.ts refuses to boot without FIRESTORE_EMULATOR_HOST).
    // Run rules tests via `npm run test:rules:emulator` (auto-manages
    // emulator lifecycle via `firebase emulators:exec`).
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'archive', 'tests/e2e/**'],
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/user-app/js'),
      '@modules': path.resolve(__dirname, './apps/user-app/js/modules'),
      '@ts': path.resolve(__dirname, './ts')
    }
  }
});
