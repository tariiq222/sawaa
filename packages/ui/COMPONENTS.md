# @sawaa/ui — Components Development Guidelines

This document outlines the rules for contributing to the shared UI primitives.
These rules are strictly enforced to keep the component library stateless,
visual, and theme-resilient.

---

## 1. Golden Rules

1. **Stateless is better:** Components should be presentational. Delegate data
   fetching and business logic to `apps/dashboard`.
2. **Tokens-first:** Never use hardcoded colors (`bg-[#...], text-[#...]`). Always
   use semantic tokens (`bg-primary`, `text-muted-foreground`).
   - If a color is missing, define it in `packages/ui/src/styles/globals.css`.
3. **Radix-powered:** Wrap Radix primitives for accessibility and behavior.
4. **Tailwind v4 bridge:** Use `@theme inline` in consumers to bridge
   tokens to Tailwind utilities.
5. **Class merging:** Always use the `cn()` helper (from `../lib/cn`) to merge
   user-provided `className` with component defaults.
6. **No locales:** Avoid locales strings. Use pass-through props (`label={t('save')}`)
   to allow app-level context.

---

## 2. Anatomy of a Primitive

Example: `Button.tsx`

```tsx
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium...",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        // ...
      },
    },
  }
)

export const Button = React.forwardRef<...>(
  ({ className, variant, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, className }))}
      {...props}
    />
  )
)
```

---

## 3. Checklist for new components

- [ ] Does it fetch data? If yes, it **does not** belong here.
- [ ] Are all colors mapped to tokens in `globals.css`?
- [ ] Is it using `cn()` for `className` merging?
- [ ] Are all dependencies Radix-ui or stateless primitives?
- [ ] Is there a Storybook story provided?
- [ ] Are there units tests (vitest)?

---

## 4. Troubleshooting Token Missing

If you need a new color:
1. Define the token in `packages/ui/src/styles/globals.css` (Light/Dark).
2. Add it to `@theme inline` (in the consumer's `globals.css`).
3. Use `bg-<name>` in code.
