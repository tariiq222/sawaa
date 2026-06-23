# Test Coverage to >85% (Sound & Practical) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise effective, regression-catching test coverage to **>85% on backend and packages**, cover all **critical security/finance/auth paths** across every surface, and **enforce** the bar with CI coverage gates — replacing decorative ("should be defined") tests with tests that assert real behavior.

**Architecture:** Phased, batched. Phase 0 wires coverage measurement + gates so progress is *measured*, not assumed. Phases 1–3 push packages and backend over a real 85% line/branch bar. Phases 4–5 cover the critical paths in dashboard + website (full frontend 85% is an explicit later, gradual effort). Mobile is **out of scope** for this plan (separate follow-up).

**Tech Stack:** pnpm workspaces + Turborepo; backend = NestJS 11 + Jest 29 + ts-jest; dashboard/website/packages = Vitest 4 (jsdom/node) + @testing-library; coverage = Jest `--coverage` (backend) and Vitest v8 provider (everything else).

## Global Constraints

- **Code is English-only** — all test names, comments, fixtures, identifiers in English. Arabic only in chat and explicitly-requested docs.
- **Tests must be effective, not decorative** — every test asserts real behavior/outcomes, covers the failure/error path and edge cases (empty/null/invalid/unauthorized/boundary), exercises the real unit (mock external I/O only, never the logic under test), and is deterministic/isolated. A test that only asserts `toBeDefined()` or wraps `execute()` in `try/catch {}` is a **defect**, not coverage.
- **Never edit or squash an existing Prisma migration** — additive only.
- **Security tiers are owner-only** — auth/authorization (guards, tokens, CASL, roles), payments/Moyasar, and provider-credential encryption: do not change production logic to make a test pass; if a test reveals a real bug, stop and report it. Tests may read these but changes to the units themselves need explicit approval.
- **Colocated tests** — backend `*.spec.ts` next to source; packages/website/dashboard follow each package's existing convention (`*.test.ts(x)`).
- **Backend test run requires** `pnpm run prisma:generate` first and `TZ=Asia/Riyadh` (already baked into `pnpm --filter=backend test`). Backend unit tests must NOT hit a real DB — mock `PrismaService`.
- **Match existing patterns** — reuse the project's strong specs as templates (listed per phase). Do not invent new test harnesses.
- **No coverage theater** — do not add `/* istanbul ignore */`, do not lower a threshold to make CI pass, do not delete a hard assertion to silence a flake. Fix the test or the gap.

---

## Coverage targets (definition of "done" for the whole plan)

| Surface | Tool | Target (line / branch) | Enforced by |
|---|---|---|---|
| `apps/backend` | Jest | **88% / 70%** (raise from current 85/65 once gaps filled) | `test:cov` thresholds in jest config |
| `packages/shared` | Vitest v8 | **90% / 85%** | new `vitest.config.ts` thresholds |
| `packages/api-client` | Vitest v8 | **90% / 85%** | `vitest.config.ts` thresholds |
| `packages/ui` | Vitest v8 | **80% / 70%** (logic units only; trivial Radix wrappers excluded via `coverage.exclude`) | `vitest.config.ts` thresholds |
| `apps/dashboard` | Vitest v8 | critical paths covered; raise floor from 25.5% → **45%** line this plan, gradual after | `vitest.config.ts` thresholds |
| `apps/website` | Vitest v8 | critical paths covered; **60%** line on `features/**` + `lib/**` | `vitest.config.ts` thresholds |
| `apps/mobile` | — | **OUT OF SCOPE** (separate plan) | — |

"Critical paths" = auth/authorization, payments/Moyasar, provider-credential encryption, refund/cancellation cascades, booking wizard state, and the cross-app zod contract.

---

## File Structure (what changes, by area)

- **Config/CI:** `packages/shared/{package.json,vitest.config.ts}`, `packages/{api-client,ui}/vitest.config.ts` (+ coverage block), `apps/backend/package.json` jest `coverageThreshold`, `apps/dashboard/vitest.config.ts`, `apps/website/vitest.config.ts`, root `package.json`/`turbo.json` (ensure `test` + a `test:cov` pipeline run shared).
- **New tests (packages):** `packages/shared/{schemas,catalog,theme,terminology}/**.test.ts`; `packages/api-client/src/**.test.ts` (client core, refresh-mutex, peekErrorBody, untested modules); `packages/ui/src/{hooks,primitives}/**.test.ts(x)`.
- **New/rewritten tests (backend):** identity (lookup-user, role-rank, auth-response.builder, password.service + 41 DTO specs), finance (bundle-purchases, refund-completed, verify-payment, invoice-seller-name, build-invoice-pdf-data), bookings (refund-completed, cancel-program, delivery-type helpers, event payloads), platform settings encryption handlers, org-experience (sanitize-text, delivery-type-input, DTOs), common (parse-entity-ref), ops (refresh-token-cleanup.cron), plus rewriting all decorative event/DTO/handler specs.
- **New tests (frontend critical):** dashboard provider hooks + permission-guard + locale-provider + programs + dashboard-home; website auth.api/auth-store/use-current-client + booking.api + booking wizard steps + public-fetch + otp-verify.

---

## Phase 0 — Measure & gate (do this first; nothing else is trustworthy without it)

Without enforced coverage numbers we cannot prove ">85%". This phase makes coverage real and CI-blocking.

### Task 0.1: Wire `packages/shared` into the test runner (it is currently dead in CI)

**Files:**
- Modify: `packages/shared/package.json` (add `vitest` devDep, `test` + `test:cov` scripts)
- Create: `packages/shared/vitest.config.ts`

**Interfaces:**
- Produces: a runnable `pnpm --filter=@sawaa/shared test` and `:test:cov` that execute the 3 existing specs (`money/money.test.ts`, `state-machines/booking-wizard.test.ts`, `constants/permissions-catalog.test.ts`) plus all new ones.

- [ ] **Step 1:** Add to `packages/shared/package.json` `devDependencies`: `"vitest": "^4.1.0"` (match the version already used by `packages/api-client`/`apps/website`; check with `cat packages/api-client/package.json | grep vitest`). Add to `scripts`: `"test": "vitest run"`, `"test:cov": "vitest run --coverage"`.
- [ ] **Step 2:** Create `packages/shared/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['schemas/**', 'money/**', 'state-machines/**', 'catalog/**', 'theme/**', 'terminology/**', 'constants/permissions-catalog.ts'],
      exclude: ['**/index.ts', '**/*.d.ts', 'types/**', 'enums/**', 'tokens/**', 'dist/**'],
      thresholds: { lines: 90, branches: 85, functions: 90, statements: 90 },
    },
  },
})
```

- [ ] **Step 3:** Run `pnpm install` at repo root, then `pnpm --filter=@sawaa/shared test`. Expected: the 3 existing specs now RUN and PASS (they were previously never executed). If `@sawaa/shared/...` import paths fail, fix the spec imports to relative paths.
- [ ] **Step 4:** Run `pnpm --filter=@sawaa/shared test:cov`. Expected: it runs and REPORTS coverage (will be BELOW threshold — that is expected; Phase 1 fills it). Confirm the command exits non-zero on the threshold miss (proves the gate works).
- [ ] **Step 5:** Commit. `git add packages/shared/package.json packages/shared/vitest.config.ts pnpm-lock.yaml && git commit -m "test(shared): wire @sawaa/shared into vitest with coverage gate"`

### Task 0.2: Add coverage thresholds to api-client and ui

**Files:** Modify `packages/api-client/vitest.config.ts`, `packages/ui/vitest.config.ts`; add `test:cov` script to each `package.json`.

- [ ] **Step 1:** Extend `packages/api-client/vitest.config.ts` `test` with a `coverage` block: `provider: 'v8'`, `include: ['src/**']`, `exclude: ['src/index.ts','src/types/**','**/*.test.ts']`, `thresholds: { lines: 90, branches: 85, functions: 90, statements: 90 }`. Add `"test:cov": "vitest run --coverage"` to its `package.json`.
- [ ] **Step 2:** Extend `packages/ui/vitest.config.ts` similarly with `include: ['src/lib/**','src/hooks/**','src/primitives/**']` and `exclude` listing the trivial Radix wrappers (input, textarea, dialog, sheet, popover, tooltip, tabs, switch, radio-group, scroll-area, command, label, separator, skeleton, badge, sonner, card, avatar, dropdown-menu, alert-dialog, sidebar shell). Thresholds `{ lines: 80, branches: 70, functions: 80, statements: 80 }`. Add `"test:cov"` script.
- [ ] **Step 3:** Run `pnpm --filter=@sawaa/api-client test:cov` and `pnpm --filter=@sawaa/ui test:cov`. Expected: both RUN and report (below threshold for now). Install `@vitest/coverage-v8` if missing (`pnpm --filter=... add -D @vitest/coverage-v8`).
- [ ] **Step 4:** Commit. `git commit -am "test(packages): add v8 coverage gates to api-client and ui"`

### Task 0.3: Tighten backend + frontend coverage config

**Files:** Modify `apps/backend` jest config (`package.json` `jest` block or `jest.config.*`), `apps/dashboard/vitest.config.ts`, `apps/website/vitest.config.ts`.

- [ ] **Step 1:** Locate the backend jest config (`grep -rl '"jest"\|jest.config' apps/backend --include=*.json --include=*.js`). Leave thresholds at current `85% line / 65% branch` for now (raising to 88/70 happens in Task 3.4 after gaps are filled). Confirm `collectCoverageFrom` excludes `*.module.ts`, `main.ts`, `*.dto.ts` barrels, generated prisma, and `*.spec.ts`.
- [ ] **Step 2:** In `apps/dashboard/vitest.config.ts`, raise `coverage.thresholds` lines `25.5 → 45`, statements `25 → 45`, functions `25 → 40`, branches `14 → 30`. (We will land tests in Phase 4 to clear this; if CI is shared, do this raise as the LAST commit of Phase 4 — note it here as a dependency.)
- [ ] **Step 3:** In `apps/website/vitest.config.ts`, add a `coverage` block scoped to `features/**` + `lib/**` with thresholds lines `60`, branches `45`, functions `55`, statements `60` (land as last commit of Phase 5).
- [ ] **Step 4:** Add a root `package.json` script `"test:cov": "turbo run test:cov"` and a `turbo.json` task `"test:cov": { "outputs": ["coverage/**"] }` so `pnpm test:cov` fans out to every package/app. Verify `pnpm test:cov` discovers shared + api-client + ui + backend + dashboard + website.
- [ ] **Step 5:** Commit the config-only parts now (Steps 1, 4). Threshold raises in Steps 2–3 are committed at the end of their phases. `git commit -m "test: add repo-wide test:cov pipeline via turbo"`

**Phase 0 DoD:** `pnpm test:cov` runs coverage for shared, api-client, ui, backend, dashboard, website; each prints a coverage summary; shared/api-client/ui gates fail (red) only because tests are not yet written — proving the gates are wired.

---

## Phase 1 — Packages to >85% real coverage

Reference templates (strong existing specs to imitate): `packages/shared/money/money.test.ts`, `packages/shared/state-machines/booking-wizard.test.ts`, `packages/api-client/src/modules/__tests__/auth.test.ts`, `packages/ui/src/lib/cn.test.ts`.

### Task 1.1: shared — zod schemas (the cross-app contract) — HIGHEST PRIORITY

**Files (create colocated `*.test.ts`):**
- `packages/shared/schemas/auth.test.ts` — `loginSchema`, `changePasswordSchema`, `passwordResetRequestSchema`, `passwordResetPerformSchema`
- `packages/shared/schemas/booking.test.ts` — `bookingStatusSchema`, `bookingTypeSchema`, `deliveryTypeSchema`, `createBookingSchema`, `updateBookingSchema`
- `packages/shared/schemas/client.test.ts` — `phoneRegex`, `saudiPhoneRegex`, `createClientSchema`, `updateClientSchema`
- `packages/shared/schemas/payment.test.ts` — `paymentMethodSchema`, `paymentStatusSchema`, `processPaymentSchema`, `refundPaymentSchema`, `verifyPaymentSchema`

**Definition of done per schema:** for each schema, at least one **valid** case that `.parse()` accepts AND multiple **invalid** cases that `.safeParse()` rejects with the expected issue path — empty string, wrong type, out-of-enum value, boundary (e.g. password min length, halalas ≥ 0, Saudi phone format `+9665XXXXXXXX` vs local `05XXXXXXXX`). Pattern:

```ts
import { describe, it, expect } from 'vitest'
import { createBookingSchema } from './booking'

describe('createBookingSchema', () => {
  it('accepts a valid booking payload', () => {
    const r = createBookingSchema.safeParse(validBooking())
    expect(r.success).toBe(true)
  })
  it('rejects an out-of-enum deliveryType', () => {
    const r = createBookingSchema.safeParse({ ...validBooking(), deliveryType: 'TELEPATHY' })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0].path).toContain('deliveryType')
  })
  // ...empty, null, boundary cases
})
```

- [ ] Read each schema file first to copy exact field names/constraints. Write tests. Run `pnpm --filter=@sawaa/shared test`. All pass. Commit per file.

### Task 1.2: shared — pure logic helpers

**Files:** `packages/shared/catalog/find-department.test.ts` (Arabic + English case-insensitive substring matching, no-match → undefined, empty query), `packages/shared/theme/generate-css.test.ts` (`generateCssVariables`: valid hex → rgb/rgba parts, 3-digit vs 6-digit hex, invalid hex handling, full CSS string shape), `packages/shared/terminology/merge-overrides.test.ts` (`mergeOverrides`: override wins, missing key falls back, empty override = identity).

- [ ] Write, run, pass, commit. After 1.1+1.2, run `pnpm --filter=@sawaa/shared test:cov` — expect **≥90% line / ≥85% branch**; if short, add cases for the uncovered lines reported.

### Task 1.3: api-client — core client + refresh concurrency (HIGH RISK)

**Files:**
- `packages/api-client/src/client.test.ts` — `apiRequest`: envelope unwrap, **flat non-envelope** branch, **204 no-content** path, **multipart FormData** (no JSON Content-Type) branch, **ORG_SUSPENDED** branch, 401 → refresh → retry success, refresh **failure fires `onAuthFailure`**, `AUTH_ENDPOINTS_NO_RETRY` skips refresh, `setApiRequestBaseUrl` init vs overwrite. Mock `fetch`.
- `packages/api-client/src/peek-error-body.test.ts` (or colocated) — `peekErrorBody` against all 4 NestJS error shapes: nested `{message:{error,message}}`, `{error:{code,message}}`, validation `message: string[]`, legacy envelope; assert `code`/`message` precedence. Assert `ApiError` `instanceof`.
- `packages/api-client/src/refresh-mutex.test.ts` — concurrent 401s reuse a single in-flight refresh; mutex resets after settle; `.finally().catch()` swallows the sentinel rejection (no unhandled rejection). Use fake timers / resolved-promise ordering.

```ts
it('serializes concurrent refreshes into one call', async () => {
  let calls = 0
  const refresh = () => { calls++; return new Promise(r => setTimeout(() => r('tok'), 10)) }
  const m = getRefreshMutex()
  await Promise.all([m.run(refresh), m.run(refresh)])
  expect(calls).toBe(1)
})
```

- [ ] Write, run, pass, commit per file. These three protect every endpoint in the platform.

### Task 1.4: api-client — untested module endpoints

**Files (extend existing `__tests__` or colocate):** add tests for the MISSING endpoints found in the audit:
- `modules/auth.ts`: `requestStaffPasswordReset`, `performStaffPasswordReset`, `requestDashboardOtp`, `verifyDashboardOtp`, `lookupUser`
- `modules/bookings.ts`: `getBooking`, `confirmBooking`, `completeBooking`
- `modules/employees.ts`: `getEmployee`, `createEmployee`, `updateEmployee`, `deleteEmployee`, breaks/vacation endpoints, `getEmployeeServices`, `updateEmployeeService`
- `modules/payments.ts`: `listPayments`, `getPaymentStats`, `processPayment`, `applyInvoiceDiscount`
- `types/api.ts`: `buildQueryString` (note the audit flagged it diverges from 3 private copies — test the exported one; if it is genuinely dead, raise it in the report rather than testing dead code).

**Per endpoint DoD:** assert URL + method + that the `Authorization` header is attached when a token is present + envelope unwrap + at least one error-status path. Fix the **weak** `dashboard-modules.test.ts` happy-path-only tests to add header + error assertions.

- [ ] Write, run, pass, commit. Run `pnpm --filter=@sawaa/api-client test:cov` — expect **≥90/85**.

### Task 1.5: ui — hooks + logic primitives

**Files:** `src/hooks/use-document-dir.test.ts` (jsdom: MutationObserver on `<html dir>`, SSR default), `src/hooks/use-mobile.test.ts` (matchMedia mock, 768px breakpoint both sides), `src/primitives/phone-input.test.tsx` (digits-only, leading-zero strip, 9-digit cap, +966 prefix, E.164 unwrap), `src/primitives/date-time-input.test.tsx` (ISO→datetime-local normalization, regex gate, invalid input rejected), `src/primitives/sidebar-context.test.tsx` (`useSidebar` throws outside provider; Ctrl/Cmd+B toggle; cookie persistence; controlled vs uncontrolled), `src/primitives/button.test.ts` (`buttonVariants` produces expected classes for each variant×size).

- [ ] Write using `@testing-library/react` `renderHook`/`render`. Run, pass, commit. Run `pnpm --filter=@sawaa/ui test:cov` — expect **≥80/70** on included files.

**Phase 1 DoD:** `pnpm --filter=@sawaa/shared test:cov`, `--filter=@sawaa/api-client test:cov`, `--filter=@sawaa/ui test:cov` all PASS thresholds (green). Dispatch `tariq-verifier` to confirm.

---

## Phase 2 — Backend critical paths (security / finance / encryption)

These are owner-only tiers. Tests must exercise the real handler with a mocked `PrismaService`. **If a test exposes a real bug, STOP and report — do not change the production unit to make the test pass without approval.** Reference templates (gold-standard existing specs): `identity/jwt.strategy.spec.ts`, `identity/casl/casl-ability.factory.spec.ts`, `identity/login/login.handler.spec.ts`, `finance/process-payment/process-payment.handler.spec.ts`, `finance/moyasar-webhook/moyasar-webhook.handler.spec.ts`, `finance/refund-payment/refund-payment.handler.spec.ts`, `integrations/zoom/upsert-zoom-config.handler.spec.ts`.

### Task 2.1: identity security gaps (create specs)

**Files (create):**
- `modules/identity/lookup-user/lookup-user.handler.spec.ts` — assert it **always** returns `{exists:true, hasPassword:true}` regardless of whether the user exists (anti-enumeration P0-12): test both "user found" and "user not found" DB mocks return the identical shape.
- `modules/identity/shared/role-rank.spec.ts` — `actorRankOf` for each role; `assertCanAssignRole` allows lower rank, **throws** on equal rank, **throws** on higher rank, throws when actor unknown (privilege-escalation gate).
- `modules/identity/shared/auth-response.builder.spec.ts` — `parseTtlSeconds` for `30s/15m/2h/7d`, invalid string fallback, missing unit; full response shape assembly.
- `modules/identity/shared/password.service.spec.ts` — `hash` produces a verifiable bcrypt hash; `verify` true on match, false on mismatch; uses 12 rounds.

- [ ] Write, run each (`pnpm --filter=backend test -- path/to/file.spec.ts`), pass, commit per file.

### Task 2.2: identity — replace decorative user/role handler specs

**Files (rewrite to assert behavior + failure path):** `users/{delete-user,remove-role,update-user,list-users,get-user,deactivate-user}.handler.spec.ts`, `roles/{list-permissions,list-roles,create-role,delete-role}.handler.spec.ts`, `client-auth/get-me.handler.spec.ts`. Each must assert the Prisma `where`/data passed, the returned shape, and at least one error/authorization path (e.g. `remove-role` must test the rank-gate — an actor cannot remove a role at/above their rank).

- [ ] Rewrite, run, pass, commit in small groups.

### Task 2.3: finance — money-critical gaps (create specs)

**Files (create):**
- `finance/bundle-purchases/use-bundle.handler.spec.ts` — serializable-isolation usage: decrements remaining, **rejects when exhausted** (overbooking guard), concurrency/locked-row path, expired bundle rejected. **P0-16.**
- `finance/bundle-purchases/create-bundle-purchase.handler.spec.ts` — VAT/subtotal math, payment-method branching, invoice creation.
- `finance/bundle-purchases/list-client-bundle-purchases.handler.spec.ts`
- `finance/get-payment/get-payment.handler.spec.ts`
- `finance/issue-invoice-receipt/build-invoice-pdf-data.spec.ts` — assembles correct seller/client/line-item data from org settings.
- `finance/get-invoice/invoice-seller-name.spec.ts` — `resolveInvoiceSellerName` picks the right legal entity across config permutations.

### Task 2.4: finance — fix the weak verify-payment + event specs

**Files (rewrite):** `finance/verify-payment/verify-payment.handler.spec.ts` — cover **deny** path, missing-payment, missing-invoice, PENDING→REJECTED, double-approve guard (not just the one approve case). `finance/events/{payment-completed,payment-failed,refund-completed}.event.spec.ts` — assert `eventName`, `version`, `source`, and `toEnvelope()` payload (not `toBeDefined`).

### Task 2.5: bookings — refund/cancel cascades + helpers (create/rewrite)

**Files (create):** `bookings/refund-completed-handler/refund-completed.handler.spec.ts` (**P0-15:** on `finance.refund.completed` → booking CANCELLED + Zoom host/start/join URLs nulled + Zoom meeting deleted; assert each side-effect), `bookings/cancel-program/cancel-program.handler.spec.ts` (cascades to all enrollments), `bookings/shared/delivery-type.helper.spec.ts` (`normalizeBookingTypes`/`requiresZoom` incl. legacy aliases), `bookings/booking-enum-transforms.spec.ts` (`mapDeliveryType`). **Rewrite:** all 6 `bookings/events/*.event.spec.ts` from `toBeDefined` to payload/eventName assertions.

### Task 2.6: platform settings encryption + ops cron (rewrite/create)

**Files (rewrite):** `platform/settings/get-platform-setting/get-platform-setting.handler.spec.ts` (mock `platformSetting.findUnique`; assert `decryptSecret` called; **exercise the catch→return-raw fallback**), `platform/settings/upsert-platform-setting/upsert-platform-setting.handler.spec.ts` (assert the `dto.secret` vs `dto.value` branch each round-trips through `encryptSecret`; mock `upsert`). **Rewrite:** `ops/cron-tasks/refresh-token-cleanup.cron.spec.ts` (mirror `outbox-publisher.cron.spec.ts`: assert both `deleteMany` calls + their `where` cutoff filters + `withCronLeader` wrap).

### Task 2.7: org-experience + common security helpers (create)

**Files (create):** `org-experience/services/sanitize-text.decorator.spec.ts` (strips `<...>` HTML — XSS guard; tag stripping, nested, attribute, benign text untouched), `org-experience/services/delivery-type-input.helper.spec.ts` (`normalizeDeliveryTypeInput`: `IN-PERSON` hyphen alias, `ONLINE`, invalid → throws), `common/parse-entity-ref.spec.ts` (UUID branch, `<PREFIX>-<n>` branch, empty param, malformed → `BadRequestException`).

**Phase 2 DoD:** `pnpm --filter=backend test` passes; the specific critical files above run green; dispatch `tariq-verifier` (`pnpm --filter=backend test -- <changed paths>`). Any production bug surfaced → reported, not silently patched.

---

## Phase 3 — Backend remaining gaps + DTO validation + raise the gate

### Task 3.1: DTO validation specs (the 41 + others)

Convert every `should be defined` DTO spec into a real `class-validator` spec using `plainToInstance` + `validate`. Reference: `identity/client-auth/client-login.dto.spec.ts`, `reset-password.dto.spec.ts`, `otp/verify-otp.dto.spec.ts`.

**DoD per DTO:** at least one valid instance with 0 errors AND one invalid instance per non-trivial decorator (`@MaxLength`, `@IsLatitude/@IsLongitude`, `@Matches`, `@ArrayMinSize`, `@IsUUID('4',{each:true})`, `@Transform` boolean coercion, `@IsInt/@Min`). Batches: identity DTOs (16), people DTOs (12), org-config DTOs (13), org-experience DTOs (13: bundles/discount-reasons/ratings/intake/services employee-* DTOs), dashboard `get-dashboard-stats.dto`.

```ts
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CreateBranchDto } from './create-branch.dto'

it('rejects an out-of-range latitude', async () => {
  const dto = plainToInstance(CreateBranchDto, { ...valid(), latitude: 999 })
  const errors = await validate(dto)
  expect(errors.some(e => e.property === 'latitude')).toBe(true)
})
```

- [ ] Work cluster-by-cluster; run `pnpm --filter=backend test -- <cluster path>` after each; commit per cluster.

### Task 3.2: replace remaining decorative handler/event/module specs

Sweep for the patterns and rewrite: `rg "toBeDefined\(\)\s*\}\)" apps/backend/src` and `rg "catch \{[^}]*\}" apps/backend/src --multiline` and module specs that only assert the module class is defined. For org-config per-handler specs that duplicate the aggregate spec, either make them assert distinct behavior or delete the redundant per-handler file (the aggregate `*.handler.spec.ts` already covers them) — do not keep false-positive coverage lines.

- [ ] Rewrite/remove, run, pass, commit per cluster.

### Task 3.3: fill remaining backend coverage gaps to clear 88%

**Files:** remaining MISSING units from the audit not covered above — bookings (`get-program`, `list-programs`, public program handlers, `publish-program`, `get-public-availability-days`, `get-client-booking`), finance (`get-payment` already in 2.3), org-experience remaining handlers, comms `events/booking-ref.util.ts`, integrations zoom `get-zoom-config` (rewrite the weak one to assert both `configured:false` and active pass-through), media `file-uploaded.event` payload, common minor helpers.

- [ ] **Step (gate check):** Run `pnpm --filter=backend test:cov`. Read the coverage summary. For every file under 88% line, add the specific missing-line tests. Re-run until summary ≥ **88% line / 70% branch** globally.

### Task 3.4: raise backend jest thresholds

- [ ] Set backend jest `coverageThreshold.global` to `{ statements: 88, lines: 88, functions: 80, branches: 70 }`. Run `pnpm --filter=backend test:cov` — must PASS. Commit `test(backend): raise coverage gate to 88/70 after filling gaps`.

**Phase 3 DoD:** `pnpm --filter=backend test:cov` green at 88/70. `tariq-verifier` confirms.

---

## Phase 4 — Dashboard critical paths

Reference templates: `test/unit/api-client.spec.ts`, `auth-provider.spec.tsx`, `use-bookings-queries.spec.tsx`, `booking-actions.spec.tsx`.

### Task 4.1: provider-credential surfaces (Critical tier)
**Files:** tests for `hooks/use-moyasar-config.ts`, `use-zoom-config.ts`, `use-sms-config.ts`, `use-email-config.ts` + `lib/api/{moyasar-config,zoom,sms,email-config}.ts`. Assert request body field names (guard against swapping `publishableKey`/`secretKey`), the write-only credential contract, test-connection call, and error path. Strengthen the shallow `moyasar-config-api.spec.ts`.

### Task 4.2: RBAC + locale (Critical: auth/authorization)
**Files:** `components/features/permission-guard.tsx` test (renders children when `canDo` true, renders no-permission UI when false, wires `canDo` correctly) and `components/locale-provider.tsx` test (real provider: `toggleLocale`, `localStorage` round-trip `sawaa-locale`, `documentElement.lang`/`dir` flip, `t()` fallback). These are currently mocked everywhere and never tested for real.

### Task 4.3: dashboard-home aggregator + programs module
**Files:** `hooks/use-dashboard-home.ts` (query composition, `enabled` flags, default ranges, loading aggregation), and the Programs feature (`hooks/use-programs.ts`, `lib/api/programs.ts`, `lib/schemas/program.schema.ts`) — CRUD + schedule + enroll happy + error paths. Add `lib/schemas/auth-login.schema.ts` test.

### Task 4.4: land the dashboard gate
- [ ] Run `pnpm --filter=dashboard test`. After 4.1–4.3 pass, apply Task 0.3 Step 2 threshold raise (line 45). Run `pnpm --filter=dashboard test -- --coverage` — must pass. Commit.

**Phase 4 DoD:** dashboard critical paths covered; dashboard coverage gate raised to 45% line and green.

---

## Phase 5 — Website critical paths

Reference templates: `features/account/profile-tab.test.tsx`, `features/contact/contact-form.test.tsx`, `features/account/invoice.api.test.ts`, `middleware.test.ts`.

### Task 5.1: client auth spine
**Files:** tests for `features/auth/auth.api.ts`, `features/auth/auth-store.ts`, `features/auth/use-current-client.ts` (login/register/refresh/claim/me/profile contract + 401/refresh), and `lib/public-fetch.ts` (envelope unwrap, error throw, query-string assembly — currently every test mocks fetch and skips this helper). Strengthen the weak `forgot-password-form.test.ts`/`reset-password-form.test.ts` to exercise the OTP→password step machine, not just `vi.fn` call-through.

### Task 5.2: public booking flow
**Files:** `features/booking/booking.api.ts` (slot fetch, draft create, payment init + error), and the wizard step components (`service-picker`, `slot-picker`, `date-strip`, `therapist-picker`, `client-info-step`, `booking-summary`, `summary-rail`). Plus `features/otp/otp-verify-form.tsx` (digit entry, paste, auto-submit, error) and `features/payment/payment.api.ts` (init/verify callbacks).

### Task 5.3: security + SEO helpers
**Files:** `lib/security/sentry-redaction.ts` (PII keys stripped before send), `lib/seo/{metadata,page-metadata,schema}.ts` (structured-data shape). `features/branding/branding-provider.tsx` + `use-branding.ts`.

### Task 5.4: land the website gate
- [ ] Run `pnpm --filter=website test`. After 5.1–5.3 pass, apply Task 0.3 Step 3 thresholds (line 60 on features+lib). Run coverage — must pass. Commit.

**Phase 5 DoD:** website critical paths covered; website coverage gate green at 60% on `features/**`+`lib/**`.

---

## Out of scope (explicit) — Mobile

`apps/mobile` (~14% coverage, ~130 untested units, outside root workspace) is **deferred to a separate plan**. The critical mobile paths to prioritize there (for the follow-up): `app/__tests__/index.test.tsx` auth-gate is already strong; next are the query-hook layer (`hooks/queries/*`), `utils/notification-deeplink.ts`, `services/employee/*`, `stores/slices/auth-slice.ts`, and the payment/booking screens. Do not touch mobile in this plan.

---

## Execution order & batching

1. **Phase 0** (one batch) — must land first; everything downstream measures against it.
2. **Phase 1** (packages) — 5 tasks; 1.1 and 1.3 are highest value, can run in parallel (different packages).
3. **Phase 2** (backend critical) — sequential by cluster; owner-review (`tariq-deep`) the diffs touching identity/finance/encryption before declaring done.
4. **Phase 3** (backend bulk + gate) — parallelizable by cluster; 3.4 last.
5. **Phase 4 + Phase 5** — independent of each other; can run in parallel.

Each task ends with: run the relevant `*:cov` command → confirm green → commit. After each phase, dispatch `tariq-verifier` on the touched layer. Phases touching security tiers (2, parts of 4/5) get a `tariq-deep` diff review.

## Self-review notes (gaps the executor must watch)
- Backend unit tests must mock `PrismaService` — if any new spec needs a live DB it belongs in `test:e2e`, not unit. Keep unit specs DB-free.
- After any change that touches an endpoint/DTO shape, run `pnpm openapi:sync` and commit the snapshot (per root AGENTS.md) — adding tests alone won't, but rewriting a DTO spec must not change the DTO; if it must, that's an endpoint change.
- `packages/shared` compiles to `dist/`; tests run against source — ensure spec imports use relative source paths, not the built `@sawaa/shared` entry.
- Do not raise a frontend threshold before its phase's tests land, or CI goes red mid-plan. Threshold raises are the LAST commit of their phase.
