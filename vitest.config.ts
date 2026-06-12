import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/domain/**/*.ts'],
      // Exclude tests, the barrel re-export, and the type-only module (no runtime code).
      exclude: [
        'src/lib/domain/**/*.test.ts',
        'src/lib/domain/index.ts',
        'src/lib/domain/types.ts',
      ],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});
