import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Storybook configuration for @sawaa/ui.
 *
 * Storybook needs to:
 *  1. Transpile the @sawaa/ui source (main: ./src/index.ts, package sets
 *     type: "module")
 *  2. Apply Tailwind 4 + the design tokens (CSS variables in styles.css)
 *  3. Wrap stories with the ThemeProvider so Radix portals + theming
 *     work in isolation
 *  4. Run TS through the same compilerOptions as the dashboard consumer
 *     (vitest.config.ts is the single source of truth for module
 *     resolution)
 *
 * @see .storybook/preview.tsx for the ThemeProvider decorator
 * @see .storybook/main.ts for the Storybook framework config
 */
export default {
  // stories: ['../src/**/*.stories.@(ts|tsx)'],
  // addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  // framework: { name: '@storybook/react-vite', options: {} },
  // typescript: { reactDocgen: 'react-docgen-typescript' },
  core: { disableTelemetry: true },
} satisfies StorybookConfig;

// The Vitest config is shared with Storybook so both use the same
// module resolution + Tailwind + TS pipeline. `mergeConfig` lets us
// add Storybook-specific overrides without forking the test config.
const vitestConfig = defineConfig({})
export const viteConfig = mergeConfig(vitestConfig, {
  // override as needed
})