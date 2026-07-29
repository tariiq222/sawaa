import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';

/**
 * Storybook stories for the Button primitive.
 *
 * The Button has 6 variants (default, outline, secondary, ghost, accent,
 * destructive, link) and 5 sizes (default, xs, sm, lg, icon). Rather
 * than enumerate every combination, we showcase the most common
 * ones and let SVG icons / `asChild` / disabled be a playground.
 *
 * Run Storybook: `pnpm --filter=@sawaa/ui storybook`
 */
const meta = {
  title: 'Forms/Button',
  component: Button,
  tags: ['autodocs'],
  args: {
    children: 'زر',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'outline',
        'secondary',
        'ghost',
        'accent',
        'destructive',
        'link',
      ],
    },
    size: {
      control: 'select',
      options: ['default', 'xs', 'sm', 'lg', 'icon'],
    },
    disabled: { control: 'boolean' },
    asChild: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Outline: Story = { args: { variant: 'outline' } }
export const Secondary: Story = { args: { variant: 'secondary' } }
export const Ghost: Story = { args: { variant: 'ghost' } }
export const Accent: Story = { args: { variant: 'accent' } }
export const Destructive: Story = { args: { variant: 'destructive' } }
export const Link: Story = { args: { variant: 'link' } }

export const Disabled: Story = { args: { disabled: true } }

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Button size="xs">XS</Button>
      <Button size="sm">SM</Button>
      <Button size="default">Default</Button>
      <Button size="lg">LG</Button>
    </div>
  ),
}