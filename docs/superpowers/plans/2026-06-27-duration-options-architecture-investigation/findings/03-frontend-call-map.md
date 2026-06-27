# 03 — Frontend Call Map: Pricing Endpoints

**Base commit:** `649e10fe` (HEAD of Task 2, "schema archaeology for pricing tables")
**Investigation date:** 2026-06-27
**Scope:** All dashboard UI screens that touch the four pricing write endpoints + their GET companions. No website/mobile call sites touched these write paths (verified via grep over `apps/website`, `apps/mobile`).

---

## 1. Routes (app router, dashboard layer)

| Route | Page file | Renders |
|---|---|---|
| `/services/create` | `apps/dashboard/app/(dashboard)/services/create/page.tsx` | `<ServiceFormPage mode="create">` (same component as edit) |
| `/services/[id]/edit` | `apps/dashboard/app/(dashboard)/services/[id]/edit/page.tsx` | `<ServiceFormPage mode="edit" serviceId={id}>` |
| `/services/[id]` | (sheet/drawer) | `<ServiceDetailSheet>` — read-only, not part of pricing writes |
| `/employees` → row click | `EditEmployeeServiceSheet` (modal/sheet opened from employee detail) | per-practitioner pricing editor |
| `/services/[id]/edit` → "employees" tab → `<AssignedEmployeeRow>` | inline edit of the same per-practitioner editor (no separate route) | per-practitioner pricing editor (same component) |

The "practitioner-pricing page" the brief assumed exists as `/services/[id]/edit#employees` — it is **embedded as a tab inside the service-edit page**, not a separate route. The two surfaces (`EditEmployeeServiceSheet` from employee-edit, and the inline row inside service-edit) share the same `EmployeeCustomPricingRow` component.

---

## 2. The four pricing write endpoints (backend)

All four live under `apps/backend/src/modules/org-experience/services/`.

| # | Handler file | HTTP | Route |
|---|---|---|---|
| 1 | `set-duration-options.handler.ts` | `PUT` | `/dashboard/organization/services/:serviceId/duration-options` |
| 2 | `set-service-booking-configs.handler.ts` | `PUT` | `/dashboard/organization/services/:serviceId/booking-types` |
| 3 | `set-employee-custom-pricing/set-employee-custom-pricing.handler.ts` | `PUT` | `/dashboard/people/employees/:employeeId/services/:serviceId/custom-pricing` |
| 4 | `set-employee-durations/set-employee-durations.handler.ts` | `PUT` | `/dashboard/people/employees/:employeeId/services/:serviceId/durations` |

Two **adjacent** handlers are also part of the pricing surface (not in the brief's 4 but documented for completeness):

| # | Handler file | HTTP | Route |
|---|---|---|---|
| 5 | `set-employee-pricing-mode/set-employee-pricing-mode.handler.ts` | `PUT` | `/dashboard/people/employees/:id/services/:serviceId/pricing-mode` |
| 6 | `set-employee-delivery-types/set-employee-delivery-types.handler.ts` | `PUT` | `/dashboard/people/employees/:id/services/:serviceId/delivery-types` |
| 7 | `set-employee-service-options.handler.ts` | `PUT` | `/dashboard/people/employees/:id/services/:serviceId/options` |
| 8 | (people.controller updateEmployeeService) | `PATCH` | `/dashboard/people/employees/:id/services/:serviceId` |

---

## 3. Call map (UI screen → mutation → endpoint → handler → DB writes)

| # | UI Screen | User Action | Mutation Hook (file:line) | Endpoint (HTTP) | Backend Handler | DB Tables Touched |
|---|---|---|---|---|---|---|
| C1 | Service edit — Basic Info tab | submit form | `updateMut` (`use-services.ts:206`) | `PATCH /dashboard/organization/services/:id` | `UpdateServiceHandler` | `Service` |
| C2 | Service edit — Basic Info tab (image changed) | submit form | `uploadServiceImage` (`lib/api/services.ts:160`) | `POST /dashboard/media/upload` + `GET /dashboard/media/:id/presigned-url` + `PATCH /dashboard/organization/services/:id {imageUrl}` | `UploadMedia` + `PresignUrl` + `UpdateServiceHandler` | `Media`, `Service` |
| C3 | Service edit — Pricing tab (toggle delivery type) | toggle button | local state only — `PricingTab` (`pricing-tab.tsx:33`) — no save until parent submit | (none) | (none — batched with C4) | (none) |
| C4 | Service edit — main Save button | submit form | `saveBookingTypesMutation` (`service-form-helpers.ts:47`) → `useServiceBookingTypesMutation` (`use-services.ts:280`) | `PUT /dashboard/organization/services/:id/booking-types` | `SetServiceBookingConfigsHandler` (`set-service-booking-configs.handler.ts`) | `ServiceBookingConfig` (deleteMany + upsert), `ServiceDurationOption` (deleteMany scoped to `(serviceId, deliveryType)` **without** `employeeServiceId` filter — see note 3a), `ServiceAvailabilityWindow` (deleteMany + createMany) |
| C5 | Service edit — "Employees" tab → Assign dialog | pick service | `assignService` (per employee) → `useEmployeeMutations().assignMut` (`use-employee-mutations.ts:135`) | `POST /dashboard/people/employees/:id/services` (x N) | `AssignEmployeeServiceHandler` | `EmployeeService` |
| C6 | Service edit — "Employees" tab → Assign dialog → save type configs | save type configs | `optionsMut` (`use-employee-mutations.ts:155`) | `PUT /dashboard/people/employees/:id/services/:serviceId/options` | `SetEmployeeServiceOptionsHandler` (`set-employee-service-options.handler.ts`) | `EmployeeServiceOption` (upsert, **scoped to service-level defaults only** — `employeeServiceId IS NULL`) |
| C7 | Service edit — "Employees" tab → assigned row → "Active" toggle | click switch | `updateMut` (`use-employee-mutations.ts:141`) | `PATCH /dashboard/people/employees/:id/services/:serviceId {isActive}` | `UpdateEmployeeServiceHandler` | `EmployeeService` |
| C8 | Service edit — "Employees" tab → assigned row → "Use custom pricing" toggle | click switch | `pricingModeMut` (`use-employee-mutations.ts:220`) | `PUT /dashboard/people/employees/:id/services/:serviceId/pricing-mode` | `SetEmployeePricingModeHandler` | `EmployeeService.useCustomPricing` (read `ServiceDurationOption WHERE employeeServiceId = link.id` count as guard) |
| C9 | Service edit — "Employees" tab → assigned row → Custom Pricing editor → Save | click save in `EmployeeCustomPricingRow.handleSave` (`employee-custom-pricing-row.tsx:129`) | `durationsMut` (`use-employee-mutations.ts:193`) | `PUT /dashboard/people/employees/:id/services/:serviceId/durations` | `SetEmployeeDurationsHandler` (`set-employee-durations.handler.ts`) | `ServiceDurationOption` (create new with `employeeServiceId = link.id`; update existing owned rows; soft-deactivate `isActive = false` for owned rows not in payload; same `ServiceDurationOption` table but rows are now owned by the practitioner, not the service — see Task 2 role verdict) |
| C10 | Service edit — "Employees" tab → assigned row → Custom Pricing editor → second save (auto-enable custom mode) | after first save with `useCustomPricing = true` | `pricingModeMut` again | same as C8 | same as C8 | same as C8 |
| C11 | Service edit — "Employees" tab → assigned row → per-type enable/disable | toggle switch | `deliveryTypesMut` (`use-employee-mutations.ts:211`) | `PUT /dashboard/people/employees/:id/services/:serviceId/delivery-types` | `SetEmployeeDeliveryTypesHandler` | `EmployeeService.disabledDeliveryTypes` |
| C12 | Employee detail → open EditEmployeeServiceSheet → "Use custom pricing" toggle | click switch | `pricingModeMut` (sheet uses the same hook) | same as C8 | same as C8 | same as C8 |
| C13 | Employee detail → sheet → Custom Pricing editor → Save | click save | `durationsMut` | same as C9 | same as C9 | same as C9 |
| C14 | Employee detail → sheet → per-type enable/disable | toggle switch | `deliveryTypesMut` | same as C11 | same as C11 | same as C11 |
| C15 | Service edit — "Employees" tab → assigned row → delete | confirm dialog | `removeMut` (`use-employee-mutations.ts:172`) | `DELETE /dashboard/people/employees/:id/services/:serviceId` | `RemoveEmployeeServiceHandler` (out of scope — does not touch pricing tables directly, cascades via Prisma onDelete on `EmployeeServiceOption.durationOptionId` etc.) | `EmployeeService` + cascade |

Notes on the call map:
- C3 and C4 are coupled: pricing-tab mutations only mutate local React state until the form's main Save fires C4. C4 is the only network call that hits `set-service-booking-configs`.
- C9 → C10 is automatic and **side-effecty**: the dashboard saves the duration list first and only then toggles `useCustomPricing` to true if the form state says so. The backend rejects enabling custom pricing with no owned rows (`set-employee-pricing-mode.handler.ts:24-33`), so the order is required.
- C7 (`updateMut` for `isActive`) and C8 (`pricingModeMut`) are sibling toggles inside the same header card but hit different endpoints (PATCH employee-service vs PUT pricing-mode).
- C6 only fires when assigning a NEW service; it does not fire on subsequent edits to an already-assigned employee. The post-assignment pricing edits for an already-assigned employee go through C8–C11 (not C6).

---

## 4. Per-row invariants (what each handler guarantees / doesn't)

**C4 — `SetServiceBookingConfigsHandler`** (`set-service-booking-configs.handler.ts:18-158`):
- **Upserts** `ServiceBookingConfig` for every type in payload (line 66).
- **Hard-deletes** any `ServiceBookingConfig` whose `deliveryType` is NOT in the payload (line 60).
- **Hard-deletes** `ServiceDurationOption` rows for the service+deliveryType **where `id NOT IN optionIds`** (line 95). The DELETE does NOT filter on `employeeServiceId` — see note 3a below.
- Recreates / upserts `ServiceDurationOption` rows in the payload (lines 102-135).
- Hard-deletes `ServiceAvailabilityWindow` rows for the service+deliveryType (line 138) and re-inserts.

**3a — Cross-handler contamination (C4 only):**
The DELETE at line 95 of `set-service-booking-configs.handler.ts`:
```ts
await tx.serviceDurationOption.deleteMany({
  where: {
    serviceId: cmd.serviceId,
    deliveryType,
    ...(optionIds.length > 0 ? { id: { notIn: optionIds } } : {}),
  },
});
```
has no `employeeServiceId` filter. In practice this is **safe today** because the controller payload (C4) only includes service-level defaults from `BookingTypesEditor.buildDurationOptionsPayload` (line 61-83) — none of those rows carry an `employeeServiceId`. But if a future caller sent a row id pointing at a practitioner-owned row, this handler would delete it. **This is a latent footgun** (suspected by Task 5 brief but confirmed here): the DELETE scope is wider than the intent.

**C9 — `SetEmployeeDurationsHandler`** (`set-employee-durations.handler.ts:22-119`):
- Verifies an active `ServiceBookingConfig` exists for each deliveryType in the payload (line 35) — fails loud otherwise.
- For each group: for each item, **update if `id` present and owned by this practitioner** (line 58-72), **create new with `employeeServiceId = link.id`** otherwise (line 83-101).
- **Soft-deactivates** (`isActive = false`, not delete) any owned row for this deliveryType whose id is NOT in the keep list (line 105-114).
- **Empty payload for a deliveryType = revert to inheriting service defaults** (line 44-50).
- Does NOT touch `EmployeeServiceOption` at all.

**C6 — `SetEmployeeServiceOptionsHandler`** (`set-employee-service-options.handler.ts:18-84`):
- **Fails loud** if the practitioner is in custom-pricing mode (line 28-32) — "set prices via the owned duration-options endpoint, not per-option overrides".
- Validates each `durationOptionId` belongs to the **service-level defaults** (`employeeServiceId IS NULL`) at line 38-47.
- Upserts `EmployeeServiceOption` for every (employeeServiceId, durationOptionId, deliveryType) tuple.

**C8 — `SetEmployeePricingModeHandler`** (`set-employee-pricing-mode.handler.ts:15-42`):
- Counts owned rows before enabling (line 24-32). Fails loud if enabling with zero owned rows.
- Plain `EmployeeService.update({ useCustomPricing })` otherwise.

**C11 — `SetEmployeeDeliveryTypesHandler`** (`set-employee-delivery-types.handler.ts:18-36`):
- Plain `EmployeeService.update({ disabledDeliveryTypes })`. Does not validate against `ServiceBookingConfig` rows — a practitioner can disable a type that is itself disabled at the service level, but that's a UI concern not a handler concern.

**C7 — `UpdateEmployeeServiceHandler`** (PATCH employee-service):
- Trivial: `EmployeeService.update({ isActive })` (no `bufferMinutes` is sent from the toggle path; the field is accepted by DTO but only set when the assign dialog is used).

---

## 5. Orphaned handlers / dead write paths

Cross-referencing the four pricing endpoints in the brief against the call map:

| Endpoint | Frontend caller? | Verdict |
|---|---|---|
| `PUT /dashboard/organization/services/:id/duration-options` (endpoint #1) | **No frontend caller.** `setDurationOptions` is imported in `hooks/use-services.ts:17`, `useDurationOptionsMutation` is exported (`use-services.ts:257`), but no `.tsx` file destructures or calls it. The only consumers of the function are `apps/dashboard/lib/api/services.ts` itself (definition) and the OpenAPI-generated `apps/dashboard/lib/types/api.generated.ts`. | **ORPHANED.** Handler still mounted in `organization-settings.controller.ts:204`. The edit UI uses **#2 (booking-types)** instead — see note 5a. |
| `PUT /dashboard/organization/services/:id/booking-types` (endpoint #2) | Yes — C4 | Active |
| `PUT /dashboard/people/employees/:id/services/:serviceId/custom-pricing` (endpoint #3) | **No frontend caller.** `customPricingMut` is exported from `useEmployeeServiceMutations` (`use-employee-mutations.ts:181`) and listed in the returned tuple (line 229), but no component destructures it. | **ORPHANED.** Handler still mounted in `people.controller.ts:681`. The dashboard uses endpoint #4 (durations) instead — see note 5b. |
| `PUT /dashboard/people/employees/:id/services/:serviceId/durations` (endpoint #4) | Yes — C9, C13 | Active |

Adjacent orphans (not in the brief's 4 but observed):

| Endpoint | Frontend caller? | Verdict |
|---|---|---|
| `PUT /dashboard/people/employees/:id/services/:serviceId/pricing-mode` (#5) | Yes — C8, C10, C12 | Active |
| `PUT /dashboard/people/employees/:id/services/:serviceId/delivery-types` (#6) | Yes — C11, C14 | Active |
| `PUT /dashboard/people/employees/:id/services/:serviceId/options` (#7) | Yes — C6 | Active (only at assign time) |
| `PATCH /dashboard/people/employees/:id/services/:serviceId` (#8) | Yes — C7 | Active |

**5a — Why is `set-duration-options` (the handler named identically to the brief's call-out) orphaned?**
The service-edit form sends the booking-type payload (endpoint #2), which **embeds** the duration options inline as `t.durationOptions[]`. The handler at `set-service-booking-configs.handler.ts` then writes both `ServiceBookingConfig` rows AND the embedded `ServiceDurationOption` rows in the same transaction. So endpoint #1 (`set-duration-options`) was either an earlier API that was superseded by #2, or a debug/admin endpoint. Either way the dashboard never uses it. The orphaned handler still happily creates rows if called — there is no in-handler guard preventing that.

**5b — Why is `set-employee-custom-pricing` (handler #3) orphaned?**
Same story at the employee-service level: the dashboard uses `EmployeeCustomPricingRow.handleSave` (C9) which sends endpoint #4 (durations). The legacy `set-employee-custom-pricing` endpoint #3 writes `EmployeeServiceOption` (the INHERIT-mode override table) and the handler itself **rejects calls when `useCustomPricing = true`** (line 26-30 of `set-employee-custom-pricing.handler.ts`) — i.e., once the practitioner is in custom mode, the only valid write path is endpoint #4. The orphaned endpoint is the "INHERIT-mode" per-practitioner price override endpoint; it has not been wired up in the dashboard UI.

**Two orphaned handlers total** (in the brief's set of four). Both are mounted in their controllers, so they would respond to a direct API call. Neither has any frontend caller in the codebase as of commit `649e10fe`.

---

## 6. Implications for Task 5 (handler behavior trace)

- **C4's `deleteMany` on `ServiceDurationOption` (line 95 of `set-service-booking-configs.handler.ts`) is the only place in the four-handler set that hard-deletes rows**, and it does so without an `employeeServiceId` filter (note 3a). This is the **plausible single-point trigger** for the production duplicate pattern observed in Task 1: if the form is submitted twice with slightly different option arrays, the upsert-then-delete flow can leave orphaned `isDefault = false` rows on first call and then re-create a fresh set on the next call, while the previous rows remain unless their ids are explicitly listed in the new payload.
- **C9 uses soft-deactivate (`isActive = false`), not delete** — owned rows persist in the table across edit cycles. Task 1's "no `isActive = false` rows accumulate?" hypothesis is **false**: rows do accumulate; they just become inactive. The same is true for `ServiceBookingConfig` rows NOT in the payload (line 60, hard delete — but those are service-level deliveryType gates, only 2 of them per service, not the duplicate-source).
- **C4's `deleteMany` scope** (note 3a) is a Task 5 candidate to re-test: does a service-edit save (C4) ever hit a `ServiceDurationOption` whose `employeeServiceId IS NOT NULL`? In current code, no — `BookingTypesEditor.buildDurationOptionsPayload` (`booking-types-editor.tsx:61-83`) only constructs the "default" option from the booking-type's `price`/`durationMins` and the additional ones from `draft.durationOptions`, none of which carry an `employeeServiceId`. So today's code never exercises the latent bug. A future caller could.

---

## 7. Gaps / caveats in this investigation

- I did NOT verify whether the mobile app (`apps/mobile`) or the public website (`apps/website`) call any of these endpoints. Grep over those trees did not surface any frontend caller of `setDurationOptions` / `setEmployeeCustomPricing` / `setEmployeeDurations` / `setServiceBookingTypes`, so they are dashboard-only by inspection. If the mobile app ever calls these, the verdict changes.
- The `EmployeeCustomPricingRow` component is shared between `EditEmployeeServiceSheet` (employee-edit) and `AssignedEmployeeRow` (service-edit). The mutation hooks used are identical in both surfaces — they call `useEmployeeServiceMutations(employee.id)` with the same `serviceId`. The dashboard intentionally renders the same editor in both places so the UX is consistent.
- The pricing-tab local-state-only path (C3) is a design choice: the form defers all writes to the main Save to keep pricing edits transactional with basic-info edits. This is why no PUT fires on every keystroke.
- I did not check whether `setServiceBookingTypes` is called from any e2e fixture or seed outside of `apps/dashboard/`. (Confirmed: it is called from `apps/dashboard/e2e/fixtures/seed.ts:589` in addition to the dashboard UI.) This does NOT change the orphan verdict for the service-level handler (the service-edit form hits it too), but the seeds are a non-UI caller that exercises the same endpoint.
- One flag I could not resolve end-to-end: in C9, after a "first save with empty rows then pricing-mode-on," the soft-deactivate path at line 105-114 of `set-employee-durations.handler.ts` only targets owned rows. If `useCustomPricing` is false and `group.items.length === 0`, the handler soft-deactivates ALL owned rows for that deliveryType. The next read of `effectiveDurations` (line 121-135) then returns the service defaults. This matches the brief's "revert to inheriting" semantics, but a Task 5 deep-dive should confirm the resolver side (`PriceResolverService`) does not read inactive rows as a fallback.
