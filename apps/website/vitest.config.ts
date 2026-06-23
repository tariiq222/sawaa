import path from 'node:path';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const root = path.resolve(__dirname);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': root,
      '@sawaa/shared/constants': path.resolve(__dirname, '../../packages/shared/constants/index.ts'),
      '@sawaa/shared/catalog': path.resolve(__dirname, '../../packages/shared/catalog/index.ts'),
      '@sawaa/shared': path.resolve(__dirname, '../../packages/shared/index.ts'),
      '@sawaa/api-client': path.resolve(__dirname, '../../packages/api-client/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['features/**', 'lib/**'],
      exclude: ['**/*.test.*', '**/*.d.ts', '**/index.ts'],
      reporter: ['text', 'text-summary'],
      // Ratchet thresholds — measured features+lib baseline (2026-06-23) at
      //   statements 76.7 / branches 71.22 / functions 75.78 / lines 77.09.
      // Each threshold is ~2 points below the measured floor so the gate
      // gates on real coverage but stays passable today. Raise these as more
      // tests land.
      thresholds: {
        statements: 74,
        branches: 69,
        functions: 73,
        lines: 75,
      },
    },
  },
});
