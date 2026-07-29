# @sawaa/ui

Shared shadcn/ui-derived UI primitives for Sawaa apps.

**Only `apps/dashboard` consumes this package today.** `apps/website` builds its own bespoke themed components (`apps/website/themes/`) and `apps/mobile` uses React Native primitives — neither has a `@sawaa/ui` dependency or tsconfig path.

Source-only ESM package — consumers transpile the TypeScript directly; no build step.

See [`CLAUDE.md`](./CLAUDE.md) for conventions, consumption instructions, and the list of components intentionally kept in `apps/dashboard/components/ui/` (carve-outs).