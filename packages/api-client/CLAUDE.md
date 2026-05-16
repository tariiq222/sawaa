# @sawaa/api-client — Typed Backend API Client

A **hand-written** typed client for the Sawa backend, consumed by `apps/website` (and partially `apps/dashboard`/`apps/mobile`).

> **Not generated.** Despite older docs calling it "generated from OpenAPI", this package is maintained by hand. The only codegen in the repo is the dashboard's separate `lib/types/api.generated.ts` (produced by `openapi-typescript` via `pnpm openapi:sync`) — a different artifact. When a backend endpoint changes, update the matching module here **manually**.

## Layout

```
src/
├── client.ts          core fetch wrapper + auth-refresh logic
├── refresh-mutex.ts    serializes concurrent token refreshes
├── index.ts            re-exports all modules
├── modules/<domain>.ts ~33 domain modules: auth, client-auth, me, bookings,
│                       clients, employees, services, branches, departments,
│                       availability, ratings, payments, invoices, coupons,
│                       intake-forms, notifications, reports, groups, users,
│                       branding, public-* , otp, contact-messages, zoom …
└── types/              domain type definitions (mirror backend DTOs)
```

## Commands

```bash
npm run test       --workspace=@sawaa/api-client   # vitest
npm run typecheck  --workspace=@sawaa/api-client
```

The package is consumed from source (`exports` → `src/index.ts`) — no build step.

## Conventions

- **One module per backend domain** under `src/modules/`. Adding an endpoint = add/extend a function in the matching module, add its types under `src/types/`, then `export` it from `index.ts`.
- `client.ts` owns the fetch + auth-refresh flow; `refresh-mutex.ts` ensures a single in-flight refresh. Don't duplicate refresh logic in a module.
- Depends only on `@sawaa/shared` (for shared types). No React, no Next.
- It's `private: true` but still exported to the workspace via `package.json` `exports`.
