import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['schemas/**', 'money/**', 'state-machines/**', 'catalog/**', 'theme/**', 'terminology/**', 'constants/permissions-catalog.ts'],
      exclude: ['**/index.ts', '**/*.d.ts', 'types/**', 'enums/**', 'tokens/**', 'dist/**'],
      thresholds: { lines: 90, branches: 85, functions: 90, statements: 90 },
    },
  },
})
