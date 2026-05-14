# Deqah Backend

NestJS 11 modular monolith — **Domain Clusters + Vertical Slices** (see [CLAUDE.md](./CLAUDE.md)).

- Architecture spec: [`docs/superpowers/specs/2026-04-11-backend-architecture-design.md`](../../docs/superpowers/specs/2026-04-11-backend-architecture-design.md)
- Multi-tenancy guide: [`docs/saas-tenancy.md`](./docs/saas-tenancy.md)

## Quick start

```bash
cp .env.example .env
npm install
npm run dev   # http://localhost:5100 (PORT=5100)
```

## Layout

```text
apps/backend/
├── prisma/
│   └── schema/            # Prisma DSL — one .prisma file per cluster
├── src/
│   ├── config/            # env validation (Joi)
│   ├── common/            # guards, interceptors, filters, pipes, base events
│   ├── infrastructure/    # tech adapters (database, queue, cache, mail, storage, events, ai, sms, zoom)
│   ├── modules/           # 14 domain clusters (see CLAUDE.md)
│   ├── api/               # HTTP layer — dashboard / mobile / public controllers
│   ├── main.ts
│   └── app.module.ts
```

## Architectural decisions

### Prisma schema location: `apps/backend/prisma/schema/`

Prisma schema DSL lives at the package root — NOT inside `src/infrastructure/database/`.

**Reasons:**

1. Prisma convention. IDE tooling, `prisma generate`, and migration scripts expect `./prisma/schema/` relative to the package root. Moving it forces `prisma.config.ts` overrides for every command.
2. `.prisma` files are not TypeScript. They're a separate DSL with their own compiler. Co-locating them with TS code mixes two different artifact types.
3. The **generated Prisma client** (`@prisma/client`) is what belongs in the infrastructure layer — not the schema source. `PrismaService` in `src/infrastructure/database/prisma.service.ts` wraps the generated client. That's the architectural boundary.
4. Split-schema strategy (one `.prisma` file per BC) is native to Prisma 7's `schema` folder — no custom tooling needed.

### Vertical Slices inside clusters

Each cluster under `src/modules/<cluster>/` is subdivided by **use case** (slice), not by layer:

```text
modules/identity/
  login/              ← slice
    login.dto.ts
    login.handler.ts
    login.handler.spec.ts
  refresh-token/      ← slice
    ...
```

No shared `controllers/`, `services/`, or `repositories/` folders. Controllers live separately under `src/api/<audience>/`. See [CLAUDE.md](./CLAUDE.md) and `docs/superpowers/specs/2026-04-11-backend-architecture-design.md`.
