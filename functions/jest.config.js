/**
 * Jest config — PR-META-6
 * ─────────────────────────────────────────────────────────────────────────────
 * Two-project setup to keep existing legacy JS tests untouched while enabling
 * TypeScript tests for new code under functions/src-ts/.
 *
 * - "legacy-js": uses functions/test/setup.js (mocks global.console — required
 *   for the 38 existing tests that intentionally silence output).
 * - "src-ts":    uses functions/test/setup-ts.js (no console mock; the new
 *   logger shim works freely in test output).
 *
 * Why two projects (not one config with both):
 *   The existing setup.js HARD-MOCKS global.console (lines 13-20). Inheriting
 *   it for new TS tests would silence the structured logger and defeat its
 *   purpose. Separate projects = separate setupFiles = clean boundary.
 *
 * Why this file exists at all:
 *   Until META-6, functions/ had NO jest.config.* file. Jest read defaults.
 *   Adding ts-jest required explicit transform config, which made the implicit
 *   default impossible.
 */
'use strict';

module.exports = {
  // Top-level shared settings
  testEnvironment: 'node',
  verbose: true,

  // Each "project" runs as an isolated test suite with its own config.
  projects: [
    // ── Project 1: existing JS tests ─────────────────────────────────────────
    {
      displayName: 'legacy-js',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/tests/**/*.test.js',
        '<rootDir>/**/*.test.js',
      ],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/lib/',
        '/src-ts/',
      ],
      // Existing setup — DO NOT modify (mocks global.console for the legacy
      // suite; 38 tests rely on the silenced output to avoid leaking
      // production-like data into the public CI log).
      setupFiles: ['<rootDir>/test/setup.js'],
    },

    // ── Project 2: new TypeScript tests (functions/src-ts/) ──────────────────
    {
      displayName: 'src-ts',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src-ts/**/__tests__/**/*.test.ts',
        '<rootDir>/src-ts/**/*.test.ts',
      ],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/lib/',
      ],
      // Separate setup — does NOT mock global.console (structured logger
      // assertions are possible; CI output may be noisier for TS tests).
      setupFiles: ['<rootDir>/test/setup-ts.js'],
      transform: {
        '^.+\\.ts$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/src-ts/tsconfig.json',
            // isolatedModules: true is set in src-ts/tsconfig.json (the
            // ts-jest config option of the same name is deprecated in v30).
          },
        ],
      },
      moduleFileExtensions: ['ts', 'js', 'json'],
    },
  ],
};
