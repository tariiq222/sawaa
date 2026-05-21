# @sawaa/test-helpers-pw — Playwright Helpers

Shared Playwright utilities for end-to-end testing across Sawa apps. This package is a **dependency of e2e suites**, not a test runner itself.

## Purpose

- Provide reusable setup/teardown logic and cross-cutting helpers for dashboard (and potentially website) Playwright tests.
- Centralize common concerns like authentication state, tenant context, webhook idempotency, and test configuration.
- Keep app-specific assertions, page objects, and secrets out of shared helpers.

## Exports

| Export Path | File | Purpose |
|---|---|---|
| `.` | `src/index.ts` | Re-exports `auth`, `tenant`, `webhook-idempotency`, `config` helpers. |
| `./global-setup` | `src/global-setup.ts` | Playwright global setup hook (runs once before all tests). |
| `./global-teardown` | `src/global-teardown.ts` | Playwright global teardown hook (runs once after all tests). |

### Helper Modules

- **`auth`** — Authentication state management for e2e tests (login helpers, session fixtures).
- **`tenant`** — Tenant/workspace context utilities for multi-tenant-aware tests (legacy stubs; keep inert).
- **`webhook-idempotency`** — Helpers to assert idempotency of webhook handlers (Moyasar, SMS DLR, etc.).
- **`config`** — Shared Playwright configuration defaults and environment helpers.

## Boundaries

### What belongs here

- Cross-test setup/teardown logic.
- Generic authentication fixtures and session builders.
- Shared configuration objects and environment parsers.
- Webhook payload builders and idempotency assertions.

### What does NOT belong here

- **App-specific assertions** — keep page-level assertions in the consuming app's e2e folder.
- **Secrets or credentials** — never commit API keys, passwords, or tokens into this package. Use environment variables or `.env` files in the consuming app.
- **Browser credential injection** — do not store or inject real user credentials into browser contexts here.
- **Page objects** — page-specific selectors and interactions belong in the app's e2e folder, not in shared helpers.

## Consumers

- `apps/dashboard/` e2e suite is the primary consumer.
- Any future Playwright-based e2e in `apps/website/` may also consume this package.

**Test specs must live in the consuming app's e2e folder** (`apps/dashboard/e2e/`, `apps/website/e2e/`), not in this package.

## Validation

```bash
# Typecheck this package
pnpm --filter=@sawaa/test-helpers-pw typecheck
```

## Conventions

- Keep helpers framework-agnostic where possible (Playwright-only, no app-specific imports).
- Prefer pure functions over class-based helpers unless stateful fixtures are required.
- When adding a new helper, consider whether it is truly cross-cutting or belongs in a single app's e2e folder.
