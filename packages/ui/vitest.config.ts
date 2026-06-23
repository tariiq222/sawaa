import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/hooks/**', 'src/primitives/**'],
      exclude: [
        'src/primitives/input.tsx',
        'src/primitives/textarea.tsx',
        'src/primitives/dialog.tsx',
        'src/primitives/sheet.tsx',
        'src/primitives/popover.tsx',
        'src/primitives/tooltip.tsx',
        'src/primitives/tabs.tsx',
        'src/primitives/switch.tsx',
        'src/primitives/radio-group.tsx',
        'src/primitives/scroll-area.tsx',
        'src/primitives/command.tsx',
        'src/primitives/label.tsx',
        'src/primitives/separator.tsx',
        'src/primitives/skeleton.tsx',
        'src/primitives/badge.tsx',
        'src/primitives/sonner.tsx',
        'src/primitives/card.tsx',
        'src/primitives/avatar.tsx',
        'src/primitives/dropdown-menu.tsx',
        'src/primitives/alert-dialog.tsx',
        'src/primitives/sidebar.tsx',
        'src/primitives/sidebar-menu.tsx',
        // Trivial Radix / react-day-picker / HTML passthroughs with no logic
        // worth testing (no branching beyond defaults / class concatenation).
        // calendar.tsx — react-day-picker DayPicker wrapper, Chevron icon pick only.
        'src/primitives/calendar.tsx',
        // checkbox.tsx — single Radix <Checkbox.Root> wrapper.
        'src/primitives/checkbox.tsx',
        // table.tsx — pure HTML element wrappers (Table, TableHeader, ...).
        'src/primitives/table.tsx',
      ],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80,
      },
    },
  },
});
