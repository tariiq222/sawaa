# @deqah/ui — Shared UI Primitives

This package holds **presentation-only** UI primitives (shadcn/ui derivatives) reused across `apps/dashboard` and `apps/website`. Mobile (`apps/mobile`) does not consume this package — it has its own React Native primitives.

## What belongs here

- Stateless visual components: Button, Card, Dialog, Input, Sheet, Popover, etc.
- Radix-wrapper primitives (DropdownMenu, ScrollArea, Tooltip, Switch, Tabs…).
- shadcn/ui derivatives whose behavior does not depend on app-level data or locale state.
- Utility helpers: `cn()` in `lib/cn`.
- Presentational hooks (no data fetching): `useDocumentDir`, `useIsMobile` in `hooks/`.

## What does NOT belong here

- Components that fetch data (any `useQuery`, `useMutation`, `axios`, or API-client imports).
- Feature-specific composites (e.g., `<BookingStatusBadge>` — that's per-app).
- Business logic (pricing rules, RBAC checks).
- Route-aware components (anything referencing `next/navigation`, `next/link`).
- Components coupled to app-level locale or translation providers (see carve-outs below).

## Carve-outs — components intentionally kept in `apps/dashboard/components/ui/`

During the SaaS-05a extraction we kept two primitives in the dashboard because they couple to dashboard-level providers and data files:

| Component | Kept in dashboard because |
|---|---|
| `date-picker.tsx` | Uses `useLocale` from `@/components/locale-provider` to drive `date-fns` locale + translated month/weekday strings. |
| `nationality-select.tsx` | Imports `COUNTRIES` from `@/lib/countries-data` plus `useLocale` for Arabic/English country display. |

**Resolution pattern** if/when we port these to `@deqah/ui`: split each into a presentational primitive here (`<DatePickerPrimitive locale={..} t={..}>` / `<NationalitySelectPrimitive options={..} dir={..}>`) and keep the data + locale wiring in the consuming app.

## Adding new components

```bash
# From apps/dashboard:
npx shadcn add <component>
# The shadcn `aliases.ui` still points at `@/components/ui` in components.json,
# so the newly generated file lands there first. Then manually move it into
# packages/ui/src/primitives/, rewrite imports:
#   @/lib/utils           → ../lib/cn
#   @/components/ui/<x>   → ./<x>        (intra-package)
#   @/hooks/use-<x>       → ../hooks/use-<x>   (move the hook too if purely presentational)
# and add `export * from "./primitives/<name>"` to packages/ui/src/index.ts.
```

Long-term: evaluate a shadcn monorepo config (`components.json` aliases) that writes directly into `@deqah/ui`.

## Consuming from an app

1. Add `"@deqah/ui": "*"` to the app's `dependencies`.
2. Add a tsconfig `paths` entry:
   ```json
   "@deqah/ui":   ["../../packages/ui/src/index.ts"],
   "@deqah/ui/*": ["../../packages/ui/src/*"]
   ```
3. Extend the Tailwind content scan to include `packages/ui/src/**/*.{ts,tsx}`.
   - Tailwind 4 inline-CSS config: add `@source "../../../packages/ui/src/**/*.{ts,tsx}";` near the `@import "tailwindcss";` line.
4. Import components: `import { Button, Card, Dialog } from "@deqah/ui"`.

## Commands

```bash
npm run test --workspace=@deqah/ui       # vitest
npm run typecheck --workspace=@deqah/ui  # tsc --noEmit
```
