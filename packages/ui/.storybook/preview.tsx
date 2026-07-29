import type { Preview } from '@storybook/react';
import { ThemeProvider } from '../src/primitives/theme-sawaa/theme-provider';
// import '../src/index.css'; // uncomment when the package gets a bundled stylesheet

/**
 * Storybook preview decorators.
 *
 * The ThemeProvider sets:
 *  - CSS variables (--sw-*) so Radix portals resolve their tokens
 *  - next-themes context so useTheme() reads the right value
 *  - dir="rtl" so the few components that render directionally
 *    look right in the canvas
 *
 * Each story can `<ThemeProvider dir="ltr">` to override, but the
 * default is rtl since Sawa is AR-first.
 */
const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'neutral',
      values: [
        { name: 'neutral', value: '#f8fafc' },
        { name: 'dark', value: '#0b1220' },
      ],
    },
    layout: 'centered',
    options: {
      storySort: {
        order: ['Foundations', 'Forms', 'Overlays', 'Layout', 'Composed'],
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
}

export default preview