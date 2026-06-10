# Dashboard e2e Tests (Playwright)

Playwright is the **official e2e platform** for `apps/dashboard`.  
Vitest unit tests live in `test/unit/` and are a separate concern.

## Structure

```
e2e/
├── fixtures/
│   ├── auth.ts       ← loginAs(page, persona) helper + storageState paths
│   ├── seed.ts       ← deterministic test data helpers (stubs — TBD)
│   └── tenant.ts     ← per-test data-isolation helper (stubs — TBD)
├── smoke/            ← ≤7 specs, must complete in <2 min
│   ├── login.spec.ts
│   ├── navigation.spec.ts
│   └── smoke.spec.ts
├── flows/            ← full feature flows grouped by domain
│   ├── bookings/
│   ├── categories/
│   ├── clients/
│   ├── departments/
│   ├── email-templates/
│   ├── employees/
│   ├── errors/
│   ├── invoices/
│   ├── notifications/
│   ├── payments/
│   ├── ratings/
│   ├── reports/
│   ├── services/
│   ├── settings/
│   └── users/
└── README.md         ← this file
```

`playwright.config.ts` lives at `apps/dashboard/` (repo root of this app), not inside `e2e/`.

## Running Tests

```bash
# Prerequisite: backend on :5200, docker stack up
npm run docker:up
npm run dev:backend   # in a separate terminal

cd apps/dashboard

# Install browser once
npm run e2e:install

# Smoke suite (~2 min, runs on every PR)
npm run e2e:smoke

# Full flows suite (nightly CI)
npm run e2e:flows

# All projects (smoke + flows)
npm run e2e

# Interactive UI mode (debugging)
npm run e2e:ui

# Show HTML report from last run
npm run e2e:report
```

## Adding a New Spec

1. Decide: smoke (login + nav + trivial read-only) or flows (feature interaction)?
2. Create the file under `e2e/smoke/` or `e2e/flows/<feature>/`.
3. Import `loginAs` from `../fixtures/auth` if auth is needed.
4. Keep smoke specs read-only / non-destructive; keep each spec under 120 lines.
5. Run `npm run e2e:smoke` (or `:flows`) locally to verify it passes.
6. Update this README if you add a new `flows/` sub-directory.

## Auth Pattern

```ts
import { loginAs } from '../fixtures/auth';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'admin');
});
```

`loginAs` fills the login form directly. Once `globalSetup` is wired
(see the TODO in `playwright.config.ts`), replace with:

```ts
test.use({ storageState: 'e2e/.auth/admin.json' });
```

## Updating CLAUDE.md

If the QA strategy changes, update the **QA Gate** section in
`apps/dashboard/CLAUDE.md` and the comment block in `playwright.config.ts`.
