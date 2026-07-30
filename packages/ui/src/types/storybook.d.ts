// Storybook ambient type declarations.
// Storybook is not installed in this package's devDependencies (to avoid
// pulling ~50 transitive deps). This shim lets the .stories.tsx files
// type-check without the real @storybook/react + @storybook/react-vite
// packages; when Storybook is installed (see packages/ui/package.json
// scripts.storybook), the real types override these automatically.

declare module '@storybook/react' {
  import type { ComponentType, ReactNode } from 'react'

  export type StoryObj<T> = {
    args?: Partial<React.ComponentProps<T>>
    render?: () => ReactNode
    // other Storybook fields are not used in this codebase
  }

  export type Meta<T> = {
    title?: string
    component: ComponentType<any>
    tags?: string[]
    args?: Record<string, unknown>
    argTypes?: Record<string, unknown>
  }

  export type Preview = {
    parameters?: Record<string, unknown>
    decorators?: Array<(Story: ComponentType) => ReactNode>
  }
}

declare module '@storybook/react-vite' {
  import type { StorybookConfig } from 'storybook/internal/types'
  export type { StorybookConfig }
}