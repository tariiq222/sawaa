# @sawaa/test-helpers-pw — Playwright Helpers

Shared Playwright helpers for dashboard e2e and possible future website e2e. This package is a **dependency of e2e suites**, not a test runner itself.

## Purpose

- Provide reusable setup/teardown logic and cross-cutting helpers for dashboard (and potentially website) Playwright tests.
- Keep shared Playwright utilities here, while app-specific specs and page objects stay in the consuming app.
- Keep app-specific assertions, page objects, and secrets out of shared helpers.

## Exports

| Export Path | File | Purpose |
|---|---|---|
| `.` | `src/index.ts` | Main entrypoint. Inspect this file to discover current helper modules. |
| `./global-setup` | `src/global-setup.ts` | Playwright global setup hook (runs once before all tests). |
| `./global-teardown` | `src/global-teardown.ts` | Playwright global teardown hook (runs once after all tests). |

When working in this package, inspect `src/index.ts` to discover current helper modules and exports. Do not assume helper module names from older docs.

## Boundaries

### What belongs here

- Cross-test setup/teardown logic.
- Generic fixtures and session builders that are reusable across Playwright suites.
- Shared configuration objects and environment parsers that do not encode app-specific behavior.
- Cross-cutting helper functions used by multiple consuming e2e suites.

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
