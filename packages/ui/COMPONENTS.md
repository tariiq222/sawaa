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

---

## 5. Onlook (Visual Editor) — Allowed Usage

[Onlook](https://github.com/onlook-dev/onlook) is a visual editor that
writes Tailwind classes back into your source. With our centralized
token system it becomes a safe productivity tool — the rules below
keep it that way.

### 5.1 Install (per-developer, not a project dependency)

Onlook CLI is a personal tool, not a project dependency. Install once,
globally or via `npx`:

```bash
# Global install (recommended for designers)
npm i -g @onlook/cli

# Or run without install
npx @onlook/cli dev
```

Do NOT add `@onlook/cli` to `apps/*/package.json`. It will not appear
in `pnpm install` output for the project. The package.json files must
remain untouched by Onlook tooling.

### 5.2 When Onlook is safe to use

Onlook-generated Tailwind classes map to our tokens as long as the
tokens exist in `packages/ui/src/styles/globals.css`. This means it is
safe for:

- **Tweaking visual properties** like spacing (`p-4`, `gap-2`),
  border radius (`rounded-md`), shadow elevation (`shadow-md`).
- **Switching between existing tokens** like `bg-primary` →
  `bg-secondary`, `text-foreground` → `text-muted-foreground`.
- **Hover/focus state adjustments** within the existing variant set
  (`hover:bg-primary/90`, `focus-visible:ring-ring`).

### 5.3 Hard guardrails — never let Onlook generate these

| Forbidden pattern | Why |
|---|---|
| `bg-[#3a5a78]`, `text-[rgb(...)]` | Bypasses tokens |
| `left-0`, `right-0` (non-logical) | Breaks RTL (Arabic) |
| `text-gray-700`, `border-slate-200` | Off-palette neutrals |
| New `<Button variant="...">` strings | Variant not in `buttonVariants` |
| Class strings mixing two variants | `cn()`'s `twMerge` will conflict |

### 5.4 Mandatory review step

Before every commit that contains Onlook-generated code:

```bash
git diff -- '*.tsx' '*.ts' | grep -E "bg-\[#|text-\[#|border-\[#" \
  && echo "FAIL: hardcoded color found" && exit 1
```

If the grep returns a hit, the change is rejected. Re-run Onlook and
pick a token from `globals.css` instead.

### 5.5 What Onlook must NOT do

- ❌ Add a new component (use `npx shadcn add <x>` + the migration
  pattern in `packages/ui/CLAUDE.md`).
- ❌ Create a new variant on `Button` / `Card` / `Badge`.
- ❌ Touch `globals.css` — tokens are owned by `packages/ui`.
- ❌ Edit the i18n / locale layer — that's data, not presentation.

### 5.6 Quick checklist for Onlook sessions

- [ ] Tokens-only colors (`bg-primary`, not `bg-[#...]`)
- [ ] Logical spacing (`ps-4`, `pe-2`, never `left-0` / `right-0`)
- [ ] Components are existing primitives (no new ones)
- [ ] `git diff` reviewed before commit
- [ ] Forbidden-pattern grep passes (see §5.4)
