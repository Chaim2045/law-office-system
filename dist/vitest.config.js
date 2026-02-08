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
        include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
        exclude: ['node_modules', 'dist', 'archive', 'tests/e2e/**'],
        testTimeout: 10000,
        hookTimeout: 10000
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './js'),
            '@modules': path.resolve(__dirname, './js/modules'),
            '@ts': path.resolve(__dirname, './ts')
        }
    }
});
//# sourceMappingURL=vitest.config.js.map