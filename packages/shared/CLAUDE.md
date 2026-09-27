# @sawaa/shared — Cross-App Types, Enums, Tokens

Pure, framework-agnostic code shared across backend, dashboard, website, and mobile: TypeScript types, enums, design tokens, business constants, and state machines. **No runtime framework deps, no data fetching, no React.**

## Layout

```
types/            domain types (auth, client-auth, payment, service, employee,
                  guest, branding, public-branding, notification, rating, api…)
enums/            shared enums (auth, user, branding, chat, notification,
                  payment, rating, otp)
constants/        roles, brand, config, permissions-catalog
tokens/           design tokens (colors, typography, spacing, shadows,
                  radius, breakpoints, animations, branding)
theme/            theme token composition
state-machines/   e.g. booking-wizard.ts (with colocated .test.ts)
i18n/             shared translation data
index.ts          re-exports everything
```

## Exports

The package exposes granular sub-paths in `package.json` `exports`: `.`, `./types`, `./enums`, `./constants`, `./tokens`, `./theme`, `./state-machines`, plus `./constants/permissions-catalog`. Import the narrowest path you need.

## Commands

```bash
npm run build       --workspace=@sawaa/shared   # tsc → dist/
npm run typecheck   --workspace=@sawaa/shared
```

This package **compiles to `dist/`** — `package.json` `main` points at `dist/index.js`. Run `build` after changing it if a consumer reads the built output (the website transpiles it from source via `transpilePackages`, but the backend may consume `dist/`).

## What belongs here

- Types/enums used by 2+ apps.
- Design tokens (single source of truth for colors/spacing/etc.).
- Business constants (roles, permission catalog).
- Pure logic with no IO (state machines).

## What does NOT belong here

- Anything importing React, Next, NestJS, or Prisma client at runtime (`@prisma/client` is a peer/dev dep for *types* only).
- API calls, data fetching, env access.
- App-specific UI components.
- Vertical terminology packs — deleted; do not reintroduce them. Sawa serves one center.


## Shared catalog logic

[Canonical clinic/service contract](../../docs/architecture/clinic-service-booking-contract.md)

catalog/ owns framework-free clinic selection and internal-service resolution for all consumers. Preserve legacy defaults, do not mutate inputs, do not derive kind from display names, and cover both clinic modes plus service groups.
