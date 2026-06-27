# Service Pricing Architecture Investigation — Synthesis

**Plan:** `docs/superpowers/plans/2026-06-27-duration-options-architecture-investigation.md`
**Base commit:** `7b454a17` (HEAD of Task 6, "index for pricing architecture findings")
**Date:** 2026-06-27
**Status:** Gate document. No code, migration, or DB change is authorized by this synthesis. The user reviews the tiers below and explicitly authorizes any follow-up plan that touches code or schema.

---

## 1. What we now know

The five findings below produce a single coherent picture: a structurally unguarded write path in a single service-level handler is the verified duplication trigger, and the surrounding customer-facing pricing flow is correct.

- **No code change in the 2026-06-22 → 2026-06-24 window produced the 61-row spike; the duplication is a recurring handler invocation.** [`findings/01-spike-2026-06-23.md`](findings/01-spike-2026-06-23.md) lines 23, 36-55: git log over the spike window surfaces ~95 commits; after filtering, none touch the `ServiceDurationOption` Prisma model, schema, handler, or seeds. The structural duplicate pattern is reproducible from the live handler code alone — `SetEmployeeDurationsHandler.execute()` lines 83–101 call `prisma.serviceDurationOption.create` unconditionally whenever the client posts an item without `id`, with no `findFirst({ serviceId, deliveryType, employeeServiceId, durationMins })` guard before the create. Verdict: `recurring-handler-call` (high confidence).
- **All three pricing tables are live and load-bearing; only the default flag is uniquely constrained.** [`findings/02-schema-archaeology.md`](findings/02-schema-archaeology.md) lines 19-31, 66: the migration timeline shows `ServiceBookingConfig` is the `(serviceId, deliveryType)` gate + INHERIT-mode step 3 fallback, `ServiceDurationOption` is the customer-facing duration/price menu (and gained `employeeServiceId` ownership on 2026-06-19), `EmployeeServiceOption` is the per-practitioner INHERIT-mode override, and `EmployeeService.useCustomPricing` (added 2026-06-20) is the boolean that switches the resolver between CUSTOM and INHERIT row sets. The schema's only UNIQUE on `ServiceDurationOption` is `WHERE isDefault=true AND isActive=true` — no constraint on `(serviceId, deliveryType, durationMins)`. The 2026-05-20 transition re-keyed uniqueness on `deliveryType`; the `EmployeeServiceOption` UNIQUE was kept across that migration and now sits on `(employeeServiceId, durationOptionId, deliveryType)` (lines 24-26).
- **Two of the four pricing write endpoints are orphaned; the service-edit PUT is the only handler the main save hits for `ServiceDurationOption`.** [`findings/03-frontend-call-map.md`](findings/03-frontend-call-map.md) lines 122-128, 142-145: endpoints #1 (`set-duration-options`) and #3 (`set-employee-custom-pricing`) are mounted in their controllers but have no frontend caller. The service-edit page calls #2 (`set-service-booking-configs`, C4) which embeds `durationOptions` inline, plus #4 (`set-employee-durations`, C9) for per-practitioner custom pricing. The page's main Save fires three sequential mutations: `PATCH /services/:id` → image upload → `PUT /services/:id/booking-types` (lines 27-33).
- **The customer-facing flow charges exactly what the choice step displays; no display-vs-charged mismatch in the read path.** [`findings/04-booking-flow-trace.md`](findings/04-booking-flow-trace.md) lines 1, 269-298, 321: `PractitionerChoicePicker` reads from `GET /public/services/:serviceId/practitioners/:employeeId/booking-options`, which composes the same priority chain (`EmployeeServiceOption.priceOverride` → `ServiceDurationOption.price` → `ServiceBookingConfig.price` → `Service.price`) that `PriceResolverService.resolve()` re-applies server-side on `POST /public/bookings` — both gated on `EmployeeService.useCustomPricing` to switch between CUSTOM (owned rows only) and INHERIT (service-defaults + override) row sets. The only "drift" is a benign two-screen price walk between the pre-therapist service picker and the post-override choice step.
- **The verified duplication trigger is `SetServiceBookingConfigsHandler` at line 121; the secondary trigger is `SetEmployeeDurationsHandler` at lines 83–101.** [`findings/05-service-edit-flow-trace.md`](findings/05-service-edit-flow-trace.md) lines 187-191, 199-208, 312: `prisma.serviceDurationOption.create` runs unconditionally when `option.id` is absent (line 121), the form's `buildDurationOptionsPayload` (`booking-types-editor.tsx:61-83`) does not dedupe by `(durationMins, price, deliveryType)`, and the upstream `deleteMany` at line 95 only filters by `id NOT IN optionIds` — not by triple equality — so a payload that includes a non-default option matching the synthetic default's `(deliveryType, durationMins)` produces two rows for the same triple. `SetEmployeeDurationsHandler` has the same pattern at lines 83–101 + 105–114 (lower blast radius; same root cause). `UpdateServiceHandler`, the image-upload path, and `SetEmployeeServiceOptionsHandler` do not touch `ServiceDurationOption` and cannot create duplicates there.

---

## 2. The verified duplication trigger

**Primary trigger — service-level handler (`PUT /dashboard/organization/services/:id/booking-types`).**

File: `apps/backend/src/modules/org-experience/services/set-service-booking-configs/set-service-booking-configs.handler.ts`

Sequence inside one PUT call:
- **Line 95** — `deleteMany` scopes by `(serviceId, deliveryType) AND id NOT IN optionIds`. Surviving rows are those whose `id` is present in the payload; rows whose `id` is absent are deleted.
- **Line 102-135** — per-option loop: `updateMany` if `option.id` is present (line 104), `create` if absent (line 121).
- **The payload shape that produces duplicates** — `BookingTypesEditor.buildDurationOptionsPayload` (`booking-types-editor.tsx:61-83`) emits a synthetic default option (lines 64-72) carrying `id: draft.defaultOptionId` plus the user's `draft.durationOptions` rows. If the user adds a non-default row whose `(durationMins, price, deliveryType)` matches the default, the PUT carries two options with the same triple and different ids. The handler updates the default's id and creates the new row ⇒ two `ServiceDurationOption` rows for `(serviceId, deliveryType, durationMins)`. The schema's partial UNIQUE only guards `isDefault=true AND isActive=true` rows, so both are accepted.

**Secondary trigger — practitioner-owned handler (`PUT /dashboard/people/employees/:id/services/:serviceId/durations`).**

File: `apps/backend/src/modules/org-experience/services/set-employee-durations/set-employee-durations.handler.ts`

- **Lines 83-101** — create branch: `prisma.serviceDurationOption.create` for every item without `id`. No `findFirst` guard for an existing `(serviceId, deliveryType, durationMins, employeeServiceId)` row.
- **Lines 105-114** — soft-deactivate leftovers: keyed by `id` equality, not by triple equality, so two rows that both made it into `keepIds` (one default + one user-added) are both kept active.

**Schema guard absence** — the database itself accepts either trigger: there is no UNIQUE on `(serviceId, deliveryType, durationMins)` (or its practitioner-owned 4-tuple variant) for `ServiceDurationOption` ([`findings/02-schema-archaeology.md`](findings/02-schema-archaeology.md) line 66).

**Customer-path impact** — zero on the resolver. The duplicates only show up as multiple rows in the admin "edit service" pricing tab, multiple rows for the same triple in the booking options fetch (filtered `isActive=true` so a duplicate is rendered twice), and inflated counts in `EmployeeService.useCustomPricing` enablement checks ([`findings/05-service-edit-flow-trace.md`](findings/05-service-edit-flow-trace.md) lines 184-191).

---

## 3. Recommended fix tiers

The tiers are ordered by safety: each tier can be authorized, shipped, and verified independently. The user must explicitly approve any tier that touches code, schema, or DB.

### Tier 1 — Safe, immediate, no user impact

**Goal:** stop new duplicates from being created without changing any user-visible behavior.

**Defense-in-depth DB guard**
- Add a partial UNIQUE index on `ServiceDurationOption(serviceId, deliveryType, durationMins, employeeServiceId) WHERE isActive=true`.
- Use the partial-index pattern from `20260520150000_finalize_delivery_type_transition/migration.sql` lines 109-119 as the model — wrap the `CREATE UNIQUE INDEX` in a `DO $$ ... $$` block that checks for duplicates first and skips creation if any exist.
- This index can only be added after Tier 2 (or after manual de-duplication) clears the existing 102 dup rows; the migration must be conditional (skip when duplicates exist) and emit a clear NOTICE.
- Optional additional index: a partial UNIQUE covering `WHERE isActive=true` only on the service-level default 3-tuple `(serviceId, deliveryType, durationMins)` for `employeeServiceId IS NULL` — same DO-block pattern.

**Handler-level guard (defense in depth, no schema change)**
- In `SetServiceBookingConfigsHandler` (lines 102-135): before `create` on line 121, run a `findFirst` on the triple `(serviceId, deliveryType, durationMins)` scoped to `employeeServiceId: null` and either return the existing row (idempotent upsert) or throw a 409 that the dashboard can translate into a refresh prompt.
- Add `employeeServiceId: null` to the `deleteMany` filter on line 95 and to the `updateMany` filter on line 104 — this bounds the service-level save strictly to service-level defaults (closes the latent cross-handler contamination vector noted in [`findings/05-service-edit-flow-trace.md`](findings/05-service-edit-flow-trace.md) lines 212-224).
- In `SetEmployeeDurationsHandler` (lines 83-101 and 105-114): same `findFirst` guard before the create; same idempotent-upsert behavior; soft-deactivate leftovers keyed by `(deliveryType, durationMins, employeeServiceId)` not by `id`.

**Prerequisites**
- None beyond local typecheck and unit tests.
- The partial UNIQUE migration is conditional and will skip when duplicates exist, so it can ship alongside the handler guard without coordinating with Tier 2.

**Risk profile**
- Handler guard: low. Localized to the two write handlers; existing payloads from the dashboard already produce the dedupe-friendly id-on-surviving-rows pattern, so the `findFirst` short-circuits on the synthetic default's id. Idempotent upsert is a strict superset of the current "create on no id" behavior.
- DB guard: very low. The DO-block pattern is already proven in `20260520150000_finalize_delivery_type_transition/migration.sql` lines 109-119. If duplicates exist the index is skipped with a NOTICE — no migration failure, no rollback.
- No user-visible change. The dashboard form's `mergeDraftsFromServer` continues to round-trip ids; the resolver continues to read the same rows.

**Verification in staging**
- Unit tests: handler tests for `SetServiceBookingConfigsHandler` and `SetEmployeeDurationsHandler` covering the "payload has matching-triple duplicate" scenarios.
- Integration test: a fixture with two `ServiceDurationOption` rows for the same triple triggers the handler guard and verifies the upsert path returns the existing id.
- Migration test: apply the partial UNIQUE migration on a DB seeded with two duplicate rows — verify the DO-block skips and emits a NOTICE.

---

### Tier 2 — Medium risk, requires migration

**Goal:** clear the existing 102 duplicate rows so the Tier 1 partial UNIQUE migration can land in production.

**Dedupe migration**
- New Prisma migration (immutable — add new, never edit existing per project rule).
- Step 1: list every `(serviceId, deliveryType, durationMins, employeeServiceId)` group with `COUNT(*) > 1 AND isActive=true`.
- Step 2: per group, decide which row to keep. Recommended criteria (must be reviewed manually before migration ships):
  - **Keep the row with the highest non-null reference** — rows referenced by `Booking.durationOptionId` should be kept when possible; secondary tiebreak is `latest updatedAt`; tertiary tiebreak is the row whose `price` matches the current `Service.price` / `ServiceBookingConfig.price` for the triple (i.e., the "intended" price).
  - **For orphaned duplicates** (no `Booking.durationOptionId` references), keep the row with the latest `createdAt` and the latest `updatedAt`, then by `id ASC` for determinism.
- Step 3: soft-deactivate (`UPDATE ... SET isActive=false`) the losing rows. Do NOT hard-delete in the first pass — `isActive=false` is reversible and matches the existing `SetEmployeeDurationsHandler` soft-deactivate pattern ([`findings/05-service-edit-flow-trace.md`](findings/05-service-edit-flow-trace.md) lines 98-99).
- Step 4: re-check the partial UNIQUE condition; if it now passes, `CREATE UNIQUE INDEX` (or do nothing if Tier 1 already shipped its conditional version, in which case this migration runs in the DO-block-success branch).

**Booking.durationOptionId FK safety check (prerequisite)**
- Before the migration is written, verify whether `Booking.durationOptionId` is nullable, and what `onDelete` mode the relation uses (`SetNull`, `Restrict`, `Cascade`). [`findings/05-service-edit-flow-trace.md`](findings/05-service-edit-flow-trace.md) lines 154, 306 flagged this; the existing `20260520150000_finalize_delivery_type_transition` migration does not mention this column, so this is the dedupe migration's responsibility.
- If the column is non-nullable with `Restrict`, the soft-deactivate-only approach is required (no hard delete). If `SetNull`, a hard delete is safe but soft-deactivate is still preferred.

**Prerequisites**
- Tier 0 (recommended pre-flight): query the production DB to confirm the 102-row scope is unchanged from the original observation. The migration should fail loud if the count has drifted beyond an agreed tolerance.
- Tier 0 (recommended pre-flight): production audit log / Sentry check for the 2026-06-23 spike window, to confirm which admin session triggered the duplicates (per [`findings/01-spike-2026-06-23.md`](findings/01-spike-2026-06-23.md) line 136: "specific date/laptop still unknown — flag for follow-up"). This is not a code change but is owner-only because it touches audit logs.

**Risk profile**
- Medium. The migration mutates customer-facing pricing rows. Even soft-deactivation will cause `GetPractitionerBookingOptionsHandler` ([`findings/04-booking-flow-trace.md`](findings/04-booking-flow-trace.md) lines 90-130) to stop returning the soft-deactivated rows. If the wrong row is chosen as the "loser", customers see a different price for that option than they would have seen before — a small but real billing impact.
- Mitigation: ship behind a feature flag or in dry-run mode (compute losers, log them, do not update) for one release cycle, then promote to live.

**Verification in staging**
- Replay: copy the production rows into staging via `SELECT ... WHERE id IN (...)`; run the dedupe logic in dry-run mode; diff against the manual review decision.
- After live: monitor `ServiceDurationOption` row count for 24 hours; verify no customer-visible price change for any service + delivery + duration triple that was previously duplicated.
- Smoke test: hit the booking wizard for every duplicated triple and confirm the displayed price matches the post-dedupe option.

---

### Tier 3 — Architectural, requires design discussion

**Goal:** make the architecture resilient to the same root cause in the future by consolidating the write paths and removing the latent contamination vectors.

**Handler consolidation**
- The service-level pricing write is split between `SetServiceBookingConfigsHandler` (booking-types + duration options + availability windows in one transaction) and `SetEmployeeDurationsHandler` (per-practitioner custom pricing). [`findings/03-frontend-call-map.md`](findings/03-frontend-call-map.md) lines 75-101, 142-145 and [`findings/05-service-edit-flow-trace.md`](findings/05-service-edit-flow-trace.md) lines 156-191 both call out that the embedded-payload pattern in `SetServiceBookingConfigsHandler` is the only handler the main service-edit save hits for `ServiceDurationOption`. A consolidated handler that takes the full service-level pricing payload and applies an idempotent upsert per triple would remove the structural footgun at its source.
- Optional: deprecate the orphaned `set-duration-options` (endpoint #1) and `set-employee-custom-pricing` (endpoint #3) handlers — they are mounted but have no UI caller ([`findings/03-frontend-call-map.md`](findings/03-frontend-call-map.md) lines 122-128).

**Cross-handler contamination guard**
- Both `updateMany` (line 104) and `deleteMany` (line 95) in `SetServiceBookingConfigsHandler` lack an `employeeServiceId: null` filter. [`findings/05-service-edit-flow-trace.md`](findings/05-service-edit-flow-trace.md) lines 212-224 confirmed this is reachable today because `get-service-booking-configs` (`set-service-booking-configs.handler.ts:160-181`) returns practitioner-owned rows in the per-config `durationOptions` array, and `mergeDraftsFromServer` (`booking-types-editor.tsx:226`) does not filter them out. The fix is two-sided: filter `employeeServiceId IS NULL` on the GET response (or in the form's merge) AND add the same filter to both handler mutations. Both sides are needed to close the path.

**Pricing tab UX**
- `PricingTab` in the service-edit form is local-state-only ([`findings/05-service-edit-flow-trace.md`](findings/05-service-edit-flow-trace.md) line 38), and `mergeDraftsFromServer` only filters `isDefault` (line 226). A user who toggles "use practitioner pricing" mid-session can see practitioner-owned rows in the service-level pricing tab. The UX fix is a separate frontend ticket but blocks the same root cause as Tier 1.

**Prerequisites**
- Architectural decision: are `EmployeeServiceOption` (legacy INHERIT-mode override) and `ServiceDurationOption.employeeServiceId` (newer ownership pattern) intended to coexist permanently, or is one being folded into the other? [`findings/02-schema-archaeology.md`](findings/02-schema-archaeology.md) lines 46-48 flagged this. The answer changes whether the consolidation is a 2-handler merge or a 3-table merge.
- User authorization for any breaking endpoint changes (orphaned handler deletion is a controller-file change with no API contract removal since the handlers are orphaned).
- Decision on whether to keep `EmployeeCustomPricingRow` (shared between `EditEmployeeServiceSheet` and `AssignedEmployeeRow`) as the single editor for both surfaces, or split it ([`findings/03-frontend-call-map.md`](findings/03-frontend-call-map.md) lines 161).

**Risk profile**
- High. Refactors that touch the write-path of customer-facing pricing require dashboard smoke coverage plus live booking-flow exercise. Any consolidation that changes the wire format breaks the OpenAPI snapshot and the hand-written `packages/api-client`.
- Owner-only surface per the project's "Security Sensitivity Tiers" (auth/payments are owner-only; pricing is adjacent to payments because it controls what is billed).

**Verification in staging**
- Dashboard smoke: every screen that writes pricing — service create/edit, employee detail, service-edit employees tab — must produce identical DB state to pre-refactor.
- Booking flow smoke: a paid booking, a pay-at-clinic booking, a custom-pricing booking, and a walk-in booking each round-trip the same price and `durationOptionId`.
- Migration replay: run every prior e2e fixture that exercises pricing against the new handler.

---

## 4. Risks per tier (consolidated)

| Tier | What could go wrong | How to verify in staging |
|---|---|---|
| **1** | Handler `findFirst` guard misfires on a payload that intentionally has two options for the same triple (e.g., A/B testing). Today this is not a real use case, but Tier 1's idempotent-upsert behavior would silently coalesce them. | Localized unit tests for both handlers covering the "double-triple" case; dashboard form diff to verify no UI change. |
| **1** | Partial UNIQUE migration is conditional; if it skips in staging the team thinks it skipped in prod too. | Confirm in staging by intentionally seeding duplicates; verify the NOTICE. Production deployment requires the migration to be re-run if duplicates are later cleared (since the DO-block gate is one-shot at the time the migration runs). |
| **2** | Wrong row chosen as "loser" causes a visible price change for one or more `(service, delivery, duration)` triples. | Dry-run mode for at least one release cycle; manual review of every loser row before the live cutover; billing smoke test for every affected triple. |
| **2** | `Booking.durationOptionId` FK behavior not verified — soft-deactivation is required if the relation is `Restrict`, not optional. | Schema re-read before migration is written; smoke test that soft-deactivation does not break booking creation. |
| **3** | Consolidation breaks the OpenAPI snapshot and the hand-written `packages/api-client` (which is hand-written, not generated — see root CLAUDE.md). | Run `pnpm openapi:sync` after the change; commit `apps/backend/openapi.json`; commit the regenerated dashboard types; commit the manual `packages/api-client` updates. |
| **3** | Deferring handler deletion (orphaned #1 and #3) is the safer path; deletion itself does not break any caller because no caller exists, but the controller and module wiring still need cleanup. | Verify zero callers with `grep` over `apps/dashboard`, `apps/website`, `apps/mobile` before deletion. |

---

## 5. Open questions

- **Production audit log / Sentry check for the 2026-06-23 spike trigger.** [`findings/01-spike-2026-06-23.md`](findings/01-spike-2026-06-23.md) line 136 produced a high-confidence verdict from local-only evidence; the specific date/laptop/session that produced the 61 rows still requires pulling the production audit log or Sentry events for 2026-06-23 to confirm which admin session saved which service+employee how many times. Recommended as Tier 0 prerequisite before Tier 1 ships, owner-only.
- **`Booking.durationOptionId` cascade behavior on `ServiceDurationOption` deletion.** [`findings/05-service-edit-flow-trace.md`](findings/05-service-edit-flow-trace.md) lines 154, 306 noted that `SetServiceBookingConfigsHandler`'s `deleteMany` at line 95 can delete rows that existing `Booking` rows reference via `Booking.durationOptionId`; the migration history in [`findings/02-schema-archaeology.md`](findings/02-schema-archaeology.md) was not re-parsed to confirm whether the FK is nullable or whether the relation is `onDelete: SetNull` / `onDelete: Restrict`. Affects whether the Tier 2 dedupe migration is safe to run as a raw DELETE without first nulling booking references.
- **`mergeDraftsFromServer` / `get-service-booking-configs` employeeServiceId filter.** [`findings/05-service-edit-flow-trace.md`](findings/05-service-edit-flow-trace.md) §6 confirmed that the dashboard GET returns practitioner-owned rows mixed into the per-config `durationOptions` array (no `employeeServiceId` filter at handler line 178), and that the form's `mergeDraftsFromServer` (`booking-types-editor.tsx:226`) only filters out `isDefault`, not `employeeServiceId IS NULL` — so a user on the service-level pricing tab can see and edit practitioner-owned rows, and the PUT then mutates them via `updateMany` at handler line 104. Tier 1 closes the handler side; the GET-side filter is part of Tier 3 (UX-correct) but could move into Tier 1 if the user wants defense-in-depth at the read path too.
- **`SetEmployeeDurationsHandler` "soft-deactivate leftovers" keep-vs-leftover math.** [`findings/05-service-edit-flow-trace.md`](findings/05-service-edit-flow-trace.md) lines 199-208 found that the keep-vs-leftover math at line 105-114 uses `id` equality, not triple equality — so if two rows with the same 4-tuple both made it into `keepIds`, neither is deactivated. Tier 1's handler guard closes this; the underlying math is still id-based but the guard prevents the "two rows in keepIds" precondition.
- **`PriceResolverService` inactive-row fallback behavior.** [`findings/04-booking-flow-trace.md`](findings/04-booking-flow-trace.md) §8 noted that the practitioner-facing options endpoint and the resolver both filter `isActive=true`; if Tier 2 soft-deactivates a duplicate, the resolver will not surface it. No risk identified, but flagging because the resolver's inactive-row fallback was not re-read.
- **Mobile booking tree divergence from the website wizard.** [`findings/04-booking-flow-trace.md`](findings/04-booking-flow-trace.md) §7 spot-checked `apps/mobile/app/(client)/booking` and confirmed the mobile tree does not implement the choice step. Not a bug — server-side billing is correct — but a UX inconsistency. Not in scope for any tier.
- **`SetEmployeeCustomPricingHandler` (orphaned, #3) and the `20260520150000_finalize_delivery_type_transition` partial-index skip behavior.** [`findings/01-spike-2026-06-23.md`](findings/01-spike-2026-06-23.md) and [`findings/02-schema-archaeology.md`](findings/02-schema-archaeology.md) confirmed the partial index `ServiceDurationOption_one_default_active_delivery_idx` was created only when existing data is clean. Whether the partial index is present in production today was not queried directly. Tier 1's new migration must check this — if the existing index is also missing in prod, the team's confidence that "data was clean" is wrong, and the dedupe criteria in Tier 2 needs re-review.
- **`EmployeeServiceOption` consolidation vs coexistence with the newer `ServiceDurationOption.employeeServiceId` ownership pattern.** [`findings/02-schema-archaeology.md`](findings/02-schema-archaeology.md) lines 46-48 noted that both patterns achieve the same outcome (practitioner-specific menu). Tier 3 requires the architectural decision on whether to keep both, fold one into the other, or unify on a single per-practitioner override table. Open.

---

## Gate statement

This document proposes three fix tiers with explicit prerequisites, risk profiles, and verification steps. **No tier is authorized.** The user reviews this synthesis, asks follow-up questions, and explicitly authorizes any follow-up plan that touches code, schema, or DB. Until then, no migrations, handler edits, or DB queries beyond the read-only `SELECT` already used in Tasks 1-5 are permitted.
