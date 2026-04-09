import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8', // Uses the V8 engine for native performance
      reporter: ['text', 'json', 'html'], // Generates terminal output and a browsable HTML report
      include: ['src/**/*.ts'], // Only track coverage for your source code
      exclude: ['node_modules/**', 'tests/**'], // Ignore external libs and tests themselves
      // intentinally keeping the coverage low for now as we just added test cases
      thresholds: {
        lines: 80,
        functions: 85,
        branches: 70,
        statements: 80,
      },
    },
    setupFiles: ['./tests/setup.ts'],
    exclude: ['**/node_modules/**', '**/build/**', '**/dist/**'],
  },
});
