# @sawaa/api-client — Typed Backend API Client

A typed client for the Sawa backend, consumed by `apps/website` (and partially `apps/dashboard`/`apps/mobile`).

> **Types are generated-derived; the client code is hand-written.**
> `src/types/generated/openapi.ts` is produced by `openapi-typescript` from
> `apps/backend/openapi.json` (via `pnpm --filter=@sawaa/api-client run
> openapi:generate`, wired into root `pnpm openapi:sync`). Every hand-written
> type file under `src/types/` now **derives** its shapes from that snapshot
> with `components["schemas"][…]` / `paths[…]` / `operations[…]` — so a backend
> response change becomes a type error here instead of drifting silently.
>
> The **fetch wrapper, auth-refresh flow and the functions in `src/modules/`**
> stay hand-written: `openapi-typescript` only emits types, never request code.
> When a backend endpoint changes, regenerate types (`pnpm openapi:sync`) and
> update the matching module **manually**. A few types are deliberately kept
> hand-written where the snapshot is wrong or under-specified (e.g.
> `CreateBookingPayload`, `CreateBranchPayload`, `SessionPackageItemInput`);
> each carries a comment explaining why.

## Layout

```
src/
├── client.ts          core fetch wrapper + auth-refresh logic
├── refresh-mutex.ts    serializes concurrent token refreshes
├── index.ts            re-exports all modules
├── modules/<domain>.ts 6 domain modules: auth, client-auth, me, bookings,
│                       employees, payments
└── types/
    ├── generated/openapi.ts  generated snapshot types — DO NOT EDIT
    └── *.ts                  hand-written type files that derive from it
```

## Commands

```bash
npm run test       --workspace=@sawaa/api-client   # vitest
npm run typecheck  --workspace=@sawaa/api-client
```

The package is consumed from source (`exports` → `src/index.ts`) — no build step.

## Conventions

- **One module per backend domain** under `src/modules/`. Adding an endpoint = add/extend a function in the matching module, add its types under `src/types/` (derived from the regenerated snapshot), then `export` it from `index.ts`.
- **Never edit `src/types/generated/openapi.ts` by hand.** Regenerate with `pnpm openapi:sync` (or `pnpm --filter=@sawaa/api-client run openapi:generate`) and commit the result. `src/types/generated-drift.test.ts` fails if the generated `paths` map stops covering every route in `endpoints.manifest.json`.
- `client.ts` owns the fetch + auth-refresh flow; `refresh-mutex.ts` ensures a single in-flight refresh. Don't duplicate refresh logic in a module.
- Depends only on `@sawaa/shared` (for shared types). No React, no Next.
- It's `private: true` but still exported to the workspace via `package.json` `exports`.


## Clinic catalog API contract

[Canonical clinic/service contract](../../docs/architecture/clinic-service-booking-contract.md)

When adding catalog or practitioner consumers, preserve the includeDirectClinics option and category kind/mode fields. Types derive from the OpenAPI snapshot, but module/handler code stays hand-written — regeneration does not rewrite request functions. Do not turn internal direct-clinic services into standalone customer services.
