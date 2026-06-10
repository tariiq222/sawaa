# Contributing to Sawa

Sawa is a **single-tenant family counseling platform** — a booking and management system for one counseling center. This guide gets you productive in under 30 minutes.

## The Apps

| App | Stack | Port |
|-----|-------|------|
| `apps/backend` | NestJS 11, Prisma 7, Postgres, Redis, MinIO, BullMQ | 5200 |
| `apps/dashboard` | Next.js 15 (App Router), React 19, TanStack Query | 5203 |
| `apps/website` | Next.js 15 public site | 5205 |
| `apps/mobile` | Expo SDK 55, RN 0.83, Expo Router | — |

> **Mobile note:** `apps/mobile` is **not** part of the root pnpm workspace commands (`pnpm build`, `pnpm test`, `pnpm dev:all` do not cover it). Run mobile commands with `pnpm --dir apps/mobile <cmd>` — never `pnpm --filter=mobile`.

Shared packages: `packages/shared` (types + zod schemas), `packages/api-client` (**hand-written** typed client — not generated), `packages/ui` (shadcn primitives, dashboard only).

## Quick Setup

```bash
# 1. Install (Node >= 20, pnpm 10)
pnpm install

# 2. Environment
cp .env.example .env        # root; each app also has its own .env.example

# 3. Infra (Postgres 16, Redis 7, MinIO)
pnpm docker:up

# 4. Database
pnpm db:migrate
pnpm db:seed

# 5. Run everything (backend + dashboard + website)
pnpm dev:all
```

Individual apps: `pnpm dev:backend`, `pnpm dev:dashboard`, `pnpm dev:website`.

## Git Hooks

`pnpm install` auto-installs [lefthook](https://github.com/evilmartians/lefthook) git hooks (root `lefthook.yml`):

- **pre-commit** — ESLint on your staged `.ts`/`.tsx` files only, per app (backend / dashboard / website), plus the legacy multi-tenant guard. Runs in seconds.
- **pre-push** — `pnpm typecheck` (turbo-cached, fast when nothing changed).

Need to bypass one? `LEFTHOOK=0 git commit` / `LEFTHOOK=0 git push`. CI runs the same checks directly — skipping locally only defers the failure.

## Before You Write Any Code

1. Read root `CLAUDE.md`, then the per-app `CLAUDE.md` for the app you're touching.
2. Search for an existing pattern before inventing a new one (backend convention: one handler per use case under `apps/backend/src/modules/<cluster>/<action>/`).
3. Check the security tiers below — some areas are owner-only.

## Running Tests

Backend uses Jest; dashboard + website use Vitest.

```bash
# backend (Jest)
pnpm --filter=backend test -- path/to/file.spec.ts          # one file
pnpm --filter=backend test -- -t "name of the test case"    # by name
pnpm --filter=backend run test:e2e                          # e2e suite
pnpm --filter=backend run test:smoke                        # smoke suite

# dashboard / website (Vitest)
pnpm --filter=dashboard test -- path/to/file.test.ts
pnpm --filter=dashboard test -- -t "name of the test case"

# dashboard e2e (Playwright) — run `pnpm --filter=dashboard run e2e:install` once
pnpm --filter=dashboard run e2e:smoke
pnpm --filter=dashboard run e2e -- path/to/spec.ts
```

### Test matrix by change surface

| Surface | Command |
|---------|---------|
| Backend handler/DTO | `pnpm --filter=backend test -- path/to/file.spec.ts` |
| Backend full suite | `pnpm --filter=backend run test` + `pnpm --filter=backend run test:e2e` |
| OpenAPI snapshot | `pnpm openapi:sync` |
| Dashboard component/page | `pnpm --filter=dashboard test -- path/to/file.test.ts` |
| Dashboard e2e smoke | `pnpm --filter=dashboard run e2e:smoke` |
| Website component/page | `pnpm --filter=website test -- path/to/file.test.ts` |
| Mobile typecheck | `pnpm --dir apps/mobile typecheck` |
| Shared / zod / api-client / UI | `pnpm typecheck` (root) |
| Everything | `pnpm typecheck` + `pnpm build` + `pnpm test` |

## API Change Checklist

When changing backend endpoints or DTOs:

1. Update backend source (controller, handler, DTO).
2. Run the relevant backend tests.
3. Run `pnpm openapi:sync` — exports `apps/backend/openapi.json` and regenerates dashboard types.
4. Update `packages/api-client` **manually** if it touches the changed endpoint or shape — it is hand-written, not generated.
5. Commit `apps/backend/openapi.json`, regenerated dashboard types, and api-client changes together.
6. Run dashboard smoke tests when the dashboard consumes the endpoint.

## Security Sensitivity Tiers

| Tier | Area | Rule |
|------|------|------|
| Critical | Auth / Authorization | Owner-only. Never change guard logic, token semantics, CASL policies, role permissions, or secret defaults without explicit approval. |
| Critical | Payments / Moyasar | Owner-only. Any change requires dashboard smoke coverage and Moyasar sandbox verification. |
| High | Provider credentials / encryption | Read-only unless explicitly scoped. Do not rotate keys, change AAD constants, or rewire encryption flows. |
| High | Migrations / destructive DB ops | Additive-only. Destructive delete/drop/truncate requires explicit confirmation. |
| Medium | OpenAPI snapshot | Regenerate via `pnpm openapi:sync` and commit with every endpoint change. |
| Medium | Dashboard smoke tests | Run after any change that could break dashboard flows. |

## Hard Rules

- **Migrations are immutable.** Never edit, rename, or squash an existing Prisma migration — always add a new one. CI fails on drift. Never `prisma db push`.
- **`apps/backend/openapi.json` is committed.** Keep it in sync (`pnpm openapi:sync`).
- **Package names stay as-is.** `@sawaa/ui` and `@sawaa/website` scopes are inherited from the original fork — do not rename them.
- **Money is stored as integer halalas** — never floats.
- **Dead frontend stubs stay dead.** `useTerminology` (dashboard) and the mobile `memberships`/`tenant-switch` services are inert leftovers; do not wire them up.

## Pre-PR Checklist

- [ ] Relevant tests pass (see test matrix above)
- [ ] Typecheck clean (`pnpm typecheck`)
- [ ] OpenAPI snapshot regenerated + committed if endpoints changed
- [ ] `packages/api-client` updated by hand if affected
- [ ] No edits to existing migrations
- [ ] No changes to owner-only areas (auth, payments) without approval
- [ ] Dashboard smoke run if dashboard flows could break

## Commit Convention

`type(scope): short description` — types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.

```
feat(bookings): add cancellation timeout task
fix(payments): handle Moyasar webhook retry correctly
```

## FAQ

**Q: Can I modify primitives in `packages/ui`?**
A: Wrap them in your app's components instead. Modify the package only when intentionally extending the design system (it serves the dashboard only).

**Q: Do I need a migration for every schema change?**
A: Yes — a new migration every time. Existing ones are immutable.

**Q: Where does shared backend logic go?**
A: `apps/backend/src/common/` (guards, interceptors, decorators) or a shared helper at the cluster root. See `apps/backend/CLAUDE.md`.

**Q: How do I run a single backend test?**
A: `pnpm --filter=backend test -- path/to/file.spec.ts` from the repo root.

**Q: Why does `pnpm --filter=mobile` fail?**
A: Mobile is outside the root workspace commands. Use `pnpm --dir apps/mobile <cmd>`.
