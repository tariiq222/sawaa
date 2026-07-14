# P0 Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the verified P0 authorization, privacy, authentication-race, and Docker build-context findings without changing supported user flows.

**Architecture:** Make authorization and data exposure fail closed at their existing boundaries; add an explicit, short-lived second-factor challenge only for the configured super-admin password flow; retain ordinary dashboard OTP login unchanged. Mobile refreshes share one in-flight request, preserving the existing retry contract. Docker exclusions prevent local backup data from entering the build context.

**Tech Stack:** NestJS 11, Prisma 7, Redis, Jest, Expo/React Native, Axios, Docker.

## Global Constraints

- Preserve the user’s existing working-tree changes; stage or commit nothing.
- Do not edit existing Prisma migrations or modify encryption keys/AAD.
- Keep ordinary dashboard passwordless OTP login working exactly as it does today.
- Only a configured super administrator using password login is subject to the new password-to-OTP challenge.
- Add regression tests before each production change; run the narrow test suite after each task.

---

## Task 1: Return only employee-safe client fields from the mobile employee endpoint

**Files:**
- Modify: `apps/backend/src/api/mobile/employee/clients.controller.ts:67-100`
- Modify: `apps/backend/src/api/mobile/employee/clients.controller.spec.ts`

- [ ] Add a failing controller test that asserts the Prisma call has an explicit `select` and that the response cannot contain `passwordHash`, token state, national ID, medical details, notes, or emergency-contact data.
- [ ] Define a local `employeeClientSelect` constant (or equivalently named, typed Prisma select) containing only fields required by the existing employee client-list UI: identifier, name, phone, gender, birth date, avatar, status, and timestamps already returned today.
- [ ] Pass the select to `this.prisma.client.findMany` and return the selected rows without adding a second incompatible response shape.
- [ ] Keep pagination, search, and sort semantics intact.
- [ ] Run `corepack pnpm --filter=backend test -- src/api/mobile/employee/clients.controller.spec.ts`.

## Task 2: Make an explicit empty database permission set deny access

**Files:**
- Modify: `apps/backend/src/modules/identity/casl/casl-ability.factory.ts:70-87`
- Modify: `apps/backend/src/common/guards/casl.guard.ts:76-91`
- Modify: `apps/backend/src/modules/identity/casl/casl-ability.factory.spec.ts:126-151`
- Modify: `apps/backend/src/common/guards/casl.guard.spec.ts:84-111`

- [ ] Replace the failing legacy expectations that grant built-in permissions for `permissions: []` with deny-all expectations.
- [ ] In both runtime decision points, distinguish `undefined` (legacy/no DB role record; retain built-in role behaviour) from an explicit empty array (configured role with no grants; deny all).
- [ ] Preserve the existing `SUPER_ADMIN` bypass and all non-empty database grants.
- [ ] Run the two focused Jest specs and then `corepack pnpm --filter=backend test -- src/modules/identity/casl/casl-ability.factory.spec.ts src/common/guards/casl.guard.spec.ts`.

## Task 3: Bind super-admin dashboard OTP completion to a successful password challenge

**Files:**
- Modify: `apps/backend/src/api/public/auth.controller.ts:105-141,286-322`
- Modify: `apps/backend/src/modules/identity/login/login.handler.ts`
- Modify: `apps/backend/src/modules/identity/request-dashboard-otp/request-dashboard-otp.dto.ts`
- Modify: `apps/backend/src/modules/identity/verify-dashboard-otp/verify-dashboard-otp.dto.ts`
- Modify: `apps/backend/src/modules/identity/request-dashboard-otp/request-dashboard-otp.handler.ts`
- Modify: `apps/backend/src/modules/identity/verify-dashboard-otp/verify-dashboard-otp.handler.ts`
- Modify: relevant specs under `apps/backend/src/api/public/` and `apps/backend/src/modules/identity/{login,request-dashboard-otp,verify-dashboard-otp}/`

- [ ] First write failing tests for this matrix: ordinary role request/verification without a password challenge succeeds; a configured super admin receives a challenge after a valid password; super-admin OTP request/verification without, expired, mismatched, or consumed challenge fails; valid matching challenge succeeds once.
- [ ] Add a narrowly scoped Redis-backed challenge record with a short TTL, bound to user ID and normalized identifier. Store only opaque random challenge IDs, not the password or OTP.
- [ ] On the existing successful password-login path, when `security.twoFactor.required` is enabled and the authenticated user is a super admin, return the existing `requiresOtp: true` response plus the opaque challenge ID. Do not issue an authenticated session from that branch.
- [ ] Make the dashboard OTP request and verification paths require and consume that challenge only when the target account is a super admin under the enabled setting. Preserve passwordless OTP for all other roles and when the setting is disabled.
- [ ] Keep public DTO validation backward compatible by making the new challenge field optional at the schema boundary, while enforcing it conditionally in the handler.
- [ ] Run all affected focused Jest specs. If endpoint DTO shapes change, run `corepack pnpm openapi:sync`, inspect the generated diff, and include it only if the snapshot actually changes.

## Task 4: Serialize simultaneous mobile token refreshes into one request

**Files:**
- Modify: `apps/mobile/services/api.ts:43-99`
- Modify: `apps/mobile/services/api.test.ts`

- [ ] Add a failing test that drives two simultaneous 401 interceptor calls and asserts that they await one `/auth/refresh` call, both retry with the same refreshed access token, and neither logs out on a successful shared refresh.
- [ ] Add a second failing test for shared refresh failure: all waiters reject consistently and stored tokens are cleared once.
- [ ] Introduce a module-scoped single-flight refresh promise that is created by the first eligible 401 and cleared in `finally`; each request retries only once as it does today.
- [ ] Preserve exclusion of retried requests and existing logout behaviour for failed refreshes.
- [ ] Run `pnpm --dir apps/mobile test -- services/api.test.ts` and `pnpm --dir apps/mobile typecheck`.

## Task 5: Exclude local backup and secret directories from Docker build contexts

**Files:**
- Modify: `.dockerignore`
- Modify: `.dockerignore` test or add a small root-level regression test only if an existing Docker-ignore test harness is present; otherwise validate with an explicit build-context listing command.

- [ ] Add exclusions for `.sawaa-data/`, `outputs/`, `.secrets/`, `secrets/`, `.env*`, and other verified local artifact paths, while preserving tracked source and required Docker files.
- [ ] Do not move, delete, or chmod existing backups in this task; that is an operational retention decision outside the build-context fix.
- [ ] Verify the paths are ignored by `docker buildx build --check` if available, otherwise inspect `docker buildx du` / build context output without building or pushing an image.

## Task 6: Cross-cutting verification and handoff

**Files:**
- Review: all files changed by Tasks 1-5

- [ ] Run `git diff --check` and confirm only intended files changed in addition to the user’s pre-existing dashboard work.
- [ ] Run `corepack pnpm --filter=backend test -- src/api/mobile/employee/clients.controller.spec.ts src/modules/identity/casl/casl-ability.factory.spec.ts src/common/guards/casl.guard.spec.ts` plus every focused authentication spec changed in Task 3.
- [ ] Run `pnpm --dir apps/mobile test -- services/api.test.ts` and `pnpm --dir apps/mobile typecheck`.
- [ ] Run `corepack pnpm typecheck`; if it is blocked by the known environment-level Turbo/PNPM path issue, run direct affected app typechecks and report the exact blocker.
- [ ] Do not commit, stage, push, or alter user-owned dashboard changes without a separate request.
