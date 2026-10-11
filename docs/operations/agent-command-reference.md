# Agent command and test reference

Read this when selecting commands, tests, or per-app instructions. Safety and deployment rules remain in the root AGENTS.md.

## Commands (run from repo root)

```bash
pnpm install
pnpm dev:backend          # backend only
pnpm dev:dashboard        # dashboard only
pnpm dev:website          # website only
pnpm dev:all              # backend + dashboard + website
pnpm build                # turbo build all three
pnpm typecheck            # turbo typecheck
pnpm lint                 # turbo lint
pnpm test                 # turbo test

pnpm docker:up            # local postgres + redis + minio
pnpm docker:down

pnpm db:migrate           # backend prisma migrate deploy
pnpm db:seed              # backend seed
pnpm db:reset             # migrate + seed

pnpm openapi:sync         # backend exports openapi.json + dashboard regenerates client

pnpm e2e:dashboard        # dashboard Playwright flows
pnpm test:premerge        # fresh isolated local Playwright + persisted booking journey
```

### Running a single test

Backend uses Jest, dashboard + website use Vitest. Run from inside the app dir:

```bash
# backend (Jest)
pnpm --filter=backend test -- path/to/file.spec.ts          # one file
pnpm --filter=backend test -- -t "name of the test case"    # by name
pnpm --filter=backend run test:e2e                          # e2e suite
pnpm --filter=backend run test:smoke                        # smoke suite

# dashboard / website (Vitest)
pnpm --filter=dashboard test -- path/to/file.test.ts
pnpm --filter=dashboard test -- -t "name of the test case"

# dashboard e2e (Playwright) — needs `pnpm --filter=dashboard run e2e:install` once
pnpm --filter=dashboard run e2e:smoke
pnpm --filter=dashboard run e2e -- path/to/spec.ts
```

## Test matrix by change surface

| Surface | Command |
|---|---|
| Backend handler/DTO | `pnpm --filter=backend test -- path/to/file.spec.ts` |
| Backend full suite | `pnpm --filter=backend run test` + `pnpm --filter=backend run test:e2e` |
| OpenAPI snapshot | `pnpm openapi:sync` |
| Dashboard component/page | `pnpm --filter=dashboard test -- path/to/file.test.ts` |
| Dashboard e2e (single spec) | `pnpm --filter=dashboard run e2e -- path/to/spec.ts` |
| Dashboard e2e smoke | `pnpm --filter=dashboard run e2e:smoke` |
| Website component/page | `pnpm --filter=website test -- path/to/file.test.ts` |
| Mobile typecheck | `pnpm --dir apps/mobile typecheck` |
| Shared / Zod schemas | `pnpm typecheck` (root) |
| API client | `pnpm typecheck` (root) |
| UI package | `pnpm --filter=@sawaa/ui typecheck` |
| Playwright helpers | `pnpm --filter=@sawaa/test-helpers-pw typecheck` |
| Full turbo typecheck | `pnpm typecheck` |
| Full turbo build | `pnpm build` |
| Full turbo test | `pnpm test` |

## Per-app conventions

Each app has its own **CLAUDE.md** (this repo does NOT use per-app AGENTS.md) with stack-specific rules:
- [apps/backend/CLAUDE.md](../../apps/backend/CLAUDE.md) — domain clusters, handler pattern, prisma split-schema
- [apps/dashboard/CLAUDE.md](../../apps/dashboard/CLAUDE.md) — Layer rules, i18n, design tokens, file limits
- [apps/mobile/CLAUDE.md](../../apps/mobile/CLAUDE.md) — Expo Router, state separation, Liquid Glass
- [apps/website/CLAUDE.md](../../apps/website/CLAUDE.md)
- [packages/shared/CLAUDE.md](../../packages/shared/CLAUDE.md)
- [packages/api-client/CLAUDE.md](../../packages/api-client/CLAUDE.md)
- [packages/ui/CLAUDE.md](../../packages/ui/CLAUDE.md) — primitives + carve-outs list
- [packages/test-helpers-pw/CLAUDE.md](../../packages/test-helpers-pw/CLAUDE.md)
