# Remaining branch integration implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the coordinator and focused delegated lanes. Steps use checkbox syntax.

**Goal:** Fix the reviewed remaining branches, preserve current develop behavior, then merge verified scoped PRs into develop.

**Architecture:** Integrate the existing client API design on current develop. Keep the Setting subject split and its original additive migration in a separate PR. Repair dependency compatibility through public Swagger test APIs and established compatible React/BullMQ versions.

**Tech Stack:** NestJS, Prisma, Next.js, Expo, pnpm, Jest/Vitest, isolated local Playwright stack.

**Spec:** `docs/architecture/client-api-unification.md`, canonical clinic/service booking contract, and the owner's approval in this chat on 2026-10-13 following the branch-readiness review.

## Global constraints

- Preserve owner local develop, its App Review documentation edits; the authorized tooling commit is merged through PR #220.
- GPT-6.1 Sol only; independent dependency and mobile writers in separate native worktrees.
- No production promotion. Merge commits through PRs into develop only after gate and critical-real-e2e succeed.
- Application publication follows build-images → staging-deploy only. Pending migrations block publication; live migration execution needs separate authorization.
- Original committed migrations remain immutable. Permission migration is copied unchanged only to the separate permission branch.
- No changes to encryption AAD, VAT default, provider credentials, or low-level booking/payment handlers.

## Review focus

- Old installed apps keep legacy routes and expected casing/envelopes.
- New practitioner sign-in and package details → confirmation flow are preserved.
- Checkout/recovery results resolving after blur or unmount do not navigate.
- Cookie mutations enforce CSRF even on old mobile routes; bearer-only requests remain usable.
- API acceptance fails on HTTP/header mismatches and uses owned isolated infrastructure only.

## Task 1: Dependency batch repair

Files: dependency manifests, pnpm-lock.yaml, and the two Swagger deep-import specs.
Contract: public SwaggerModule.createDocument schema assertions; established React19.2.4/renderer and BullMQ5.76.4 contracts.
- [x] Reproduce the two failing Swagger suites on the original dependency branch.
- [x] Replace private imports with public schema-generation assertions and align versions.
- [ ] Run focused specs, frozen install and root typecheck; parent runs integration checks and premerge.
- [x] Score coherent change with Jev and review actual diff before commit/push.

## Task 2: Client API integration and mobile repair

Files: client controllers/DTOs/handlers, CSRF/channel/throttle boundaries, packages/api-client, website and apps/mobile; exclude permission-split files listed in the private integration manifest.
Interfaces: `/client/*` canonical DTOs + pagination; existing legacy aliases remain; mobile adapters retain screen-level contracts.
- [x] Apply original branch diff to origin/develop with three-way application, preserving newer source behavior.
- [x] Keep current PackageDetailsStep wrapper and add focus guard to packages/confirm and extracted pending-recovery hook.
- [x] Verify guard regressions RED → GREEN, canonical adapters, success-without-invoice and redirect filtering.
- [x] Replace informational legacy smoke shell with guarded assertion runner; test wrong HTTP status, missing deprecation and non-isolated URL before implementing.
- [ ] Run backend and frontend/mobile focused tests and types; build backend and regenerate OpenAPI/dashboard types from owned local stack.
- [ ] Run full relevant suites, real-database contracts, isolated premerge and actual Moyasar Sandbox acceptance before merge.

## Task 3: Separate permission split

Files: 41 paths in private permission-files.json; no core API/mobile changes.
Interface: Content/PersonalData/ProviderConfig/Refund permissions preserve prior effective access; original additive SQL remains unchanged.
- [x] Import split to an independent develop-based branch; preserve migration bytes exactly.
- [ ] Run permission-parity and dashboard tests and isolated SQL migration validation.
- [ ] Prepare reviewed PR and request separate staging migration authorization with concrete SQL/evidence before applying or merging this application dependency.

## Task 4: Review, merge and verify

- [ ] Independent GPT-6.1 Sol review of each repaired candidate; fix critical/important findings and run fresh relevant checks.
- [ ] Merge verified PRs with `gh pr merge --merge --match-head-commit <sha>`.
- [ ] Run scripts/sync-develop.sh after each merge, report any owner-local divergence without reset/rebase.
- [ ] Verify fixed-path staging artifact/runtime evidence and hand over exact staging SHA for owner acceptance.
- [ ] Clean only integrated task branches/worktrees whose ownership and preservation have been verified.
