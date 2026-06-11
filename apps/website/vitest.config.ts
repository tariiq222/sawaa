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
  },
});
