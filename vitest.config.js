import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8', // Uses the V8 engine for native performance
      reporter: ['text', 'json', 'html'], // Generates terminal output and a browsable HTML report
      include: ['src/**/*.ts'], // Only track coverage for your source code
      exclude: ['node_modules/**', 'tests/**'], // Ignore external libs and tests themselves
    },
  },
});
