# Contributing to Deqah

Welcome to Deqah — a multi-tenant SaaS clinic platform. This guide gets you productive in under 30 minutes.

## Quick Setup

```bash
# 1. Clone & install
git clone <repo-url> && cd deqah
pnpm install

# 2. Environment
cp .env.example .env
# Fill in: DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET,
# MOYASAR_PLATFORM_*, MOYASAR_TENANT_DEFAULT_*, ZOOM_ENCRYPTION_KEY,
# SMS_ENCRYPTION_KEY, AUTHENTICA_API_KEY, MINIO_*, ADMIN_HOSTS,
# TENANT_ENFORCEMENT=strict

# 3. Database
cd apps/backend
npx prisma migrate deploy
npm run seed

# 4. Start everything
cd ../.. && pnpm dev:all
# backend   → http://localhost:5100
# dashboard → http://localhost:5103   (per-tenant)
# admin     → http://localhost:5104   (super-admin)
# website   → http://localhost:5105   (public)
# Expo      → http://localhost:5102
```

## Before You Write Any Code

Read these in order — skip none:

| # | File | What it covers |
|---|------|----------------|
| 1 | `CLAUDE.md` | Project rules, multi-tenancy, golden rules, design context |
| 2 | `docs/architecture/ARCHITECTURE.md` | Topology, request pipeline, cluster tree, vertical slices |
| 3 | `apps/backend/CLAUDE.md` | Backend module conventions per cluster |
| 4 | `apps/dashboard/CLAUDE.md` | Dashboard layer rules + Page Anatomy Law |
| 5 | `apps/mobile/CLAUDE.md` (if mobile) or `apps/admin/CLAUDE.md` (if super-admin) | App-specific conventions |
| 6 | `docs/architecture/module-ownership.md` | Live owned-models map |

## Layer Rules

### Backend (NestJS) — Vertical Slices, NOT Controller→Service→Repository

```
apps/backend/src/modules/<cluster>/<action>/
├── <action>.controller.ts    (or registered in src/api/<surface>/)
├── <action>.handler.ts       business logic — one slice, one intent
├── <action>.dto.ts           Zod schema + types
├── <action>.spec.ts          unit tests
└── <action>.e2e.spec.ts      integration (incl. tenant isolation)
```

- One folder per intent (`create-booking`, `cancel-booking`, …) — not one service per feature
- Handlers are thin and direct; reach into Prisma when needed
- DTOs use Zod (`ZodValidationPipe`)
- Every endpoint goes through `TenantResolverMiddleware` + `JwtAuthGuard`
- Plan-tier-restricted endpoints add `@UseGuards(FeatureGuard)`
- Owner-only clusters (payments, identity, tenant infra, `platform/admin|billing|verticals`): require `@tariq` review

### Frontend (Next.js — dashboard / admin / website)

```
app/<route-group>/[feature]/page.tsx          ← thin route entry
  └── components/features/[feature]/          ← UI composition
        └── hooks/queries/[feature]/          ← TanStack Query
              └── lib/api/[feature].ts        ← typed fetch
```

- UI primitives come from `@deqah/ui` — **do not modify them in place**
- Compose primitives in `components/features/`
- Imports are one-way downward; never sideways across features
- All user-facing strings: AR + EN entries (i18n parity)
- Per-tenant dashboard uses semantic tokens only — `BrandingConfig` overrides at runtime
- Dashboard list pages MUST follow the Page Anatomy Law in root `CLAUDE.md`

### Mobile (Expo)

- Redux Toolkit only for `auth` slice; everything else uses TanStack Query (`hooks/queries/`)
- Theme reads `PublicBranding` from backend; never hardcode colors
- Terminology mirrors dashboard via `useTerminology()`

## New Feature Checklist

### Backend slice
- [ ] Folder at `apps/backend/src/modules/<cluster>/<action>/`
- [ ] `<action>.handler.ts` with the business logic
- [ ] `<action>.dto.ts` with Zod schema
- [ ] Controller registered in `src/api/<surface>/` or `<action>.controller.ts`
- [ ] Prisma schema updated (correct cluster file in `prisma/schema/`)
- [ ] Migration: `npx prisma migrate dev --name <descriptive>`
- [ ] If new model is tenant-scoped: `organizationId` column + RLS policy in the migration
- [ ] Unit tests in `<action>.spec.ts`
- [ ] Tenant-isolation e2e in `<action>.e2e.spec.ts`
- [ ] If plan-tier-restricted: `FeatureGuard` applied + plan entry in seed

### Dashboard / Admin
- [ ] Page: `app/<route-group>/<feature>/page.tsx`
- [ ] Components: `components/features/<feature>/`
- [ ] Types: from `@deqah/api-client` (don't redefine)
- [ ] Query/mutation hooks: `hooks/queries/<feature>/`
- [ ] Query keys added to `lib/query-keys.ts`
- [ ] Translations: `messages/ar.json` + `messages/en.json` (parity)
- [ ] Page Anatomy Law respected (list pages)
- [ ] Sidebar link added (if user-visible)

### Mobile
- [ ] Screen under correct route group (`(client)`, `(employee)`, or `(auth)`)
- [ ] Service in `services/` (or `services/{client,employee}/`)
- [ ] TanStack Query hook in `hooks/queries/`
- [ ] Translations in `i18n/locales/`
- [ ] Theme tokens, no raw colors

## Pre-PR Checklist

- [ ] No file exceeds **350 lines**
- [ ] No `any` (use `unknown` + type guard if needed)
- [ ] No hardcoded hex colors / no `text-gray-*` (semantic tokens only)
- [ ] No raw `<input>`/`<select>`/`<textarea>` — use `@deqah/ui` primitives
- [ ] No cross-feature imports
- [ ] No `prisma db push` — `prisma migrate dev` only
- [ ] Migrations are additive (never edit/squash existing ones)
- [ ] RTL tested for any new dashboard/mobile screen
- [ ] Loading + error + empty states implemented
- [ ] **Tenant-isolation e2e** for any new tenant-scoped feature
- [ ] **i18n parity (AR/EN)** for any user-facing string
- [ ] **FeatureGuard** applied if plan-tier-restricted
- [ ] Unit + e2e tests pass
- [ ] Typecheck clean (`npm run typecheck` in affected workspace)

## Commit Convention

Format: `type(scope): short description`

| Type | When |
|------|------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change, no behavior change |
| `test` | Adding/updating tests |
| `docs` | Documentation only |
| `chore` | Tooling, deps, config |
| `perf` | Performance improvement |

**Examples:**
```
feat(bookings): add cancellation timeout task
fix(payments): handle Moyasar webhook retry correctly
refactor(saas-06a): bookings — t() literals
test(backend): cover client payment-init e2e + unit
docs(claude): rewrite root CLAUDE.md for multi-tenant SaaS
```

Commit size limit: **≤10 files OR ≤500 lines** per commit. One system per commit.

**Branch naming:**
```
feat/<saas-phase-or-feature>
fix/<short-issue>
refactor/<scope>
hotfix/<short-issue>
```

## Owner-Only Areas (require @tariq review)

- `apps/backend/src/modules/finance/` (payments, Moyasar, refunds)
- `apps/backend/src/modules/identity/` (auth, OTP, JWT, memberships, switch-org)
- `apps/backend/src/common/tenant/` (resolver, RLS, scoping extension)
- `apps/backend/src/modules/platform/{admin,billing,verticals}/`
- `apps/admin/` (super-admin app)
- `apps/backend/prisma/schema/` and any migrations
- `CODEOWNERS`

## FAQ

**Q: Can I modify primitives in `@deqah/ui`?**
A: Wrap them in `components/features/`. Modify `@deqah/ui` only if you're intentionally extending the design system.

**Q: Can I add a new color or hex value?**
A: No. Add a semantic token. Per-tenant `BrandingConfig` depends on it.

**Q: My file is approaching 350 lines. What do I do?**
A: Split by responsibility now. Don't wait to cross the line.

**Q: Do I need a migration for every schema change?**
A: Yes — `prisma migrate dev --name <descriptive>`. Never `prisma db push`.

**Q: Can I import a component from another feature folder?**
A: No. Promote to `@deqah/ui` (if generic) or `components/features/shared/` (if domain-shared).

**Q: Where does shared backend logic go?**
A: `apps/backend/src/common/` (guards, interceptors, decorators) or as a `shared/` slice inside the cluster.

**Q: How do I add a new permission/role?**
A: CASL ability in `apps/backend/src/modules/identity/casl/`, plus a permission string and a Prisma seed entry.

**Q: How do I gate a feature by plan tier?**
A: Define the feature flag in `platform/feature-flags/`, attach `@UseGuards(FeatureGuard)` on the controller, and link to the relevant `Plan` row.

**Q: Where do I file QA findings?**
A: `docs/superpowers/qa/<feature>-report-<date>.md` + a `data/kiwi/<domain>-<date>.json` plan synced via `npm run kiwi:sync-manual`.
