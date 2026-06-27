# 04 — Booking Flow Trace (Customer Side)

**Base commit:** `23ea0103` (HEAD of Task 3, "frontend call map for pricing endpoints")
**Investigation date:** 2026-06-27
**Scope:** The website's customer-facing booking flow — the wizard under `apps/website/app/booking/page.tsx`, the supporting read APIs, and the `POST /api/v1/public/bookings` write path that resolves the actual charged price. The mobile booking tree (`apps/mobile/app/(client)/booking`) was spot-checked only for divergence from the website path.

---

## 1. Public booking wizard — location and structure

The booking wizard lives at **`apps/website/app/booking/page.tsx`** (not `apps/website/src/app/booking/` — the website is a Next.js App Router project under `app/`, not `src/app/`). The page is the default-export `BookingWizardPage` (line 1306), which wraps the client-side `BookingWizardInner` in a `Suspense` boundary.

The actual wizard component is **`apps/website/app/booking/page.tsx:376` (`BookingWizardInner`)**, with all state managed via two `useReducer`s:
- `reduce` from `@sawaa/shared` (the canonical wizard state machine, line 386) — drives `state.step` (`WizardStep.SERVICE | THERAPIST | SLOT | INFO_OTP | PAYMENT | CONFIRMATION`)
- The local `uiReducer` (line 115) — drives `UiState` (branch, choice, practitioner options, redirect URL, etc.)

Visible screens (line 168-173, `buildFlow`):
- **service entry**: `service → therapist → choice → slot → info`
- **therapist entry** (`?employeeId=` deep link): `therapist → service → choice → slot → info`

Branch is **not** a numbered step — it is auto-selected from `branches` on load and may be changed via the side-summary edit affordance (`jumpToScreen('branch')` opens the `BranchStep` modal at line 1083).

The choice step is the "duration + delivery-type" picker. It is shown via `PractitionerChoicePicker` (line 1138) which is **separate** from the service picker — see section 2.

---

## 2. GET endpoints that power each step (and what each returns)

All reads happen via `publicFetch('/api/v1/...')` (helper at `apps/website/lib/public-fetch.ts`, prefixing `/api/v1`). The bookings page opens with three parallel queries on mount:

### 2a. Catalog (`page.tsx:421-435`)

- **Endpoint:** `GET /api/v1/public/services`
- **Handler:** `PublicCatalogController.getCatalog()` at `apps/backend/src/api/public/catalog.controller.ts:22-101`
- **DB reads (in parallel, lines 27-87):**
  - `Department` WHERE `isActive=true AND isVisible=true`, ORDER BY `sortOrder`
  - `ServiceCategory` WHERE `isActive=true`, ORDER BY `sortOrder`
  - `Service` WHERE `isActive=true AND isHidden=false AND archivedAt=null`, SELECT including `durationOptions` (line 55-67) **filtered `WHERE employeeServiceId IS NULL AND isActive=true`** and `bookingConfigs` (line 68-76) WHERE `isActive=true`
  - `OrganizationSettings` SELECT `vatRate`
- **Returns:** `{ departments, categories, services, vatRate }` — controller response wraps these in the body. Frontend's `unwrap()` helper (`booking.api.ts:44-50`) handles both shapes.
- **Caching:** `cache.getOrSet('ref:public-catalog', ..., 300)` — 300-second cache (line 100).

### 2b. Public employees (`page.tsx:413-419`)

- **Endpoint:** `GET /api/v1/public/employees`
- **Used for:** `TherapistPicker` (`features/booking/therapist-picker.tsx`). No pricing read at this step.

### 2c. Branches (`page.tsx:442-445`)

- **Endpoint:** `GET /api/v1/public/branches`
- **Handler / DB read:** `getPublicBranches()` in `booking.api.ts:52-55`.
- **Used for:** auto-select main branch (effect at `page.tsx:527-534`); `BranchStep` modal (line 1083).

### 2d. Practitioner booking options (`page.tsx:661` and `page.tsx:682`)

- **Endpoint:** `GET /api/v1/public/services/:serviceId/practitioners/:employeeId/booking-options`
- **Handler:** `PublicCatalogController.getPractitionerBookingOptionsEndpoint` (`catalog.controller.ts:103-139`) → `GetPractitionerBookingOptionsHandler.execute` at `apps/backend/src/modules/org-experience/services/get-practitioner-booking-options/get-practitioner-booking-options.handler.ts:28-178`.
- **DB reads (in order):**
  1. `EmployeeService` lookup by `employeeId_serviceId` unique — `useCustomPricing`, `disabledDeliveryTypes`, `isActive` (line 30-41). 404 if missing.
  2. `Service` SELECT currency / visibility (line 49-58). 404 if hidden/archived.
  3. `Employee` SELECT `isActive` (line 68-71).
  4. `ServiceBookingConfig` list WHERE `serviceId, isActive=true` — the **candidate delivery types** (line 77-80).
  5. Per-candidate-type loop (line 90-175):
     - **If `useCustomPricing=true`:** read owned `ServiceDurationOption WHERE serviceId, deliveryType, employeeServiceId=link.id, isActive=true`, ORDER BY `sortOrder` (line 93-105). If empty for this type, skip it entirely. Build one `BookingOption` per row using `row.price` and `row.durationMins` (line 108-117). **No fallback to service-default.**
     - **If `useCustomPricing=false`:** read service-default `ServiceDurationOption WHERE employeeServiceId IS NULL AND isActive=true` for that deliveryType (line 120-132). For each, query `EmployeeServiceOption WHERE employeeServiceId=link.id AND durationOptionId=row.id AND isActive=true` (line 137-144). Compose `BookingOption` using `override.priceOverride ?? row.price` and `override.durationOverride ?? row.durationMins` (line 145-158). If **no service-default options for this type**, fall back to `ServiceBookingConfig.price/durationMins` (line 160-173).
- **Returns:** `{ useCustomPricing, disabledDeliveryTypes, options: BookingOption[] }` where `BookingOption = { deliveryType, durationOptionId, durationMins, price, currency, label }` (handler lines 9-16). Note: `durationOptionId` is `""` (empty string) when falling back to `ServiceBookingConfig` (line 167).
- **NOT cached** (no `cache.getOrSet` here; called per-practitioner-select).

### 2e. Availability — slots per day (`page.tsx:601-618`)

- **Endpoint:** `GET /api/v1/public/employees/:employeeId/availability?date=...&serviceId=...&branchId=...&durationOptionId=...&deliveryType=...`
- **Used for:** the `SlotPicker` (`features/booking/slot-picker.tsx`).

### 2f. Availability — days probe (`page.tsx:622-640`)

- **Endpoint:** `GET /api/v1/public/employees/:employeeId/availability/days?serviceId=...&branchId=...&days=14`
- **Used for:** greying-out the `DateStrip` (`features/booking/date-strip.tsx`).

---

## 3. Booking-creation POST endpoint

### 3a. Route and handler

- **Endpoint:** `POST /api/v1/public/bookings`
- **Controller:** `PublicBookingsController.create()` at `apps/backend/src/api/public/bookings.controller.ts:39-67`
- **Wrapper handler:** `CreatePublicBookingHandler.execute()` at `apps/backend/src/modules/bookings/public/create-public-booking.handler.ts:34-52`
- **Domain handler:** `CreateBookingHandler.execute()` at `apps/backend/src/modules/bookings/create-booking/create-booking.handler.ts:56-443` (this is the actual business logic)

The brief expected the public entry to be the inner `CreateBookingHandler` directly. **It isn't** — the real public route goes through the wrapper, which:
1. Resolves `branchId` (auto-picks main branch when omitted — `create-public-booking.handler.ts:54-73`)
2. Sets `source: 'ONLINE'` (line 48) — this is what makes the booking start as `AWAITING_PAYMENT` instead of `CONFIRMED` (see line 265-269 of `create-booking.handler.ts`).
3. Delegates to `CreateBookingHandler.execute()` with the full `CreateBookingCommand`.

### 3b. Payload shape

Defined by `CreatePublicBookingDto` and re-serialized by the frontend in `apps/website/features/booking/booking.api.ts:108-119`:

```ts
interface AuthedBookingPayload {
  serviceId: string;        // required
  employeeId: string;       // required
  branchId: string;         // required by frontend; optional per DTO (handler resolves)
  startsAt: string;         // ISO datetime
  durationOptionId?: string;
  deliveryType?: 'IN_PERSON' | 'ONLINE';
  bookingType?: 'INDIVIDUAL' | 'ONLINE' | 'WALK_IN' | 'GROUP'; // legacy
  couponCode?: string;
  notes?: string;
}
```

Frontend post site (`page.tsx:1200-1207`):
```ts
await createBooking({
  serviceId: service.id,
  employeeId: employee.id,
  branchId: effectiveBranchId,
  startsAt: slot.startTime,
  durationOptionId: selectedChoice?.durationOptionId,
  deliveryType: selectedChoice?.deliveryType,
});
```

The client session cookie (`client_access_token`) authenticates the call via `ClientSessionGuard` (`bookings.controller.ts:37`) and the controller extracts `client.id` from the verified session, **never** from the request body (security note at `bookings.controller.ts:53`).

---

## 4. Pricing path inside `CreateBookingHandler`

### 4a. Pre-resolve validation gates

Before pricing, the handler runs a sequence of integrity checks (`create-booking.handler.ts:56-198`):

| Lines | What it reads | Why |
|---|---|---|
| 62-64 | `BookingSettings` via `GetBookingSettingsHandler` (by `branchId`) | gating constants (buffer, lead time) |
| 67-73 | `OrganizationSettings.paymentAtClinicEnabled` | reject `payAtClinic=true` when disabled |
| 76-79 | normalize `(bookingType, deliveryType)` via `normalizeBookingTypes` | legacy bookingType → new deliveryType mapping |
| 81-86 | `Branch` by id | 404 if missing; reject if `isActive=false` |
| 88-92 | `Client` by id, `deletedAt=null` | 404 if missing |
| 94-99 | `Employee` by id | 404 if missing; reject if `isActive=false` |
| 101-120 | `Service` by id (+ `category.bookingMode`) | 404 / reject if `isActive=false` / `archivedAt != null` / hidden-in-non-DIRECT-category |
| 122-130 | `EmployeeService` by `employeeId_serviceId` unique | 400 if missing or `isActive=false` |
| 137-166 | `EmployeeService.disabledDeliveryTypes` + (in custom mode) `ServiceDurationOption WHERE employeeServiceId = link.id AND isActive = true AND durationOptionId = ...` | reject if deliveryType is opt-out or option is not owned |
| 171-186 | `ServiceCategory` + `Department` for snapshot fields | denormalize for invoice/booking history |
| 189-198 | `ServiceBookingConfig WHERE serviceId, isActive=true` SELECT `deliveryType` | reject if deliveryType not supported |

### 4b. `PriceResolverService.resolve()` — the actual pricing call

At **`create-booking.handler.ts:201-208`**:

```ts
const resolved = await this.priceResolver.resolve({
  serviceId: dto.serviceId,
  employeeServiceId: employeeService.id,             // the EmployeeService.id (join row), NOT employeeId
  durationOptionId: dto.durationOptionId ?? null,
  bookingType: bookingType ?? null,
  deliveryType: deliveryType ?? null,
  useCustomPricing: employeeService.useCustomPricing === true,
});
```

**`useCustomPricing` is read directly from `EmployeeService.useCustomPricing`** (line 207). The handler does **not** look it up from anywhere else; the row was just fetched on line 122. The booleanness is explicit (`=== true`), so a `null` in the DB falls through to `false`.

**`employeeServiceId` is the `EmployeeService.id` (the join-row PK)**, not `dto.employeeId`. This matters because `ServiceDurationOption.employeeServiceId` references the join row, not the employee. The handler is correct here — confirmed against the schema (see Task 2).

**`durationOptionId` is forwarded verbatim** from `dto.durationOptionId`. The frontend strips empty strings before posting (`booking.api.ts:111-112`), so this is either a valid UUID or `null`.

### 4c. Resolution chain (per `price-resolver.service.ts:40-169`)

#### Step 1: `resolveDurationOption(...)` at line 62-68

Two branches by mode:

- **CUSTOM (`useCustomPricing=true` AND `employeeServiceId` set, lines 196-218):**
  - If `durationOptionId` provided: `ServiceDurationOption.findFirst WHERE id, serviceId, employeeServiceId, isActive=true` (line 199-202). The option **must** be one of the practitioner's owned rows; null → throws `'Practitioner has no custom pricing for the selected option'` (line 86).
  - Else if `deliveryType`: try the practitioner's owned row scoped to that deliveryType, ORDER BY `isDefault DESC, sortOrder ASC` (line 205-209). Null → continue.
  - Else: try any active owned row for this service, ORDER BY `deliveryType ASC, sortOrder ASC` (line 213-217). Null → throws.

- **INHERIT (`useCustomPricing=false`, lines 220-249):**
  - If `durationOptionId` provided: `findFirst WHERE id, serviceId, employeeServiceId: null, isActive=true` (line 221-226). **Critically: `employeeServiceId: null` filter** — service-default rows only.
  - Else if `deliveryType`: try the default option scoped to that deliveryType, `isDefault=true, isActive=true, employeeServiceId=null` (line 229-235).
  - Else: any default option for the service (line 238-242).
  - Last resort: first active service-default row regardless of `isDefault` (line 245-249).

#### Step 2 (INHERIT mode only): `EmployeeServiceOption` override lookup at lines 102-115

If `employeeServiceId` is set AND a duration option resolved, query `EmployeeServiceOption.findFirst WHERE employeeServiceId, durationOptionId, isActive=true, [deliveryType]`. The `deliveryType` scope is only added if non-null.

#### Step 3 (INHERIT mode only, when no duration option resolved): fallback chain at lines 117-149

- 3a: `ServiceBookingConfig.findFirst WHERE serviceId, deliveryType, isActive=true` (line 125-129). If found, return its `price/durationMins` with `durationOptionId: ''`.
- 3b: `Service.findUniqueOrThrow WHERE id=serviceId` and return its `price/durationMins` with `durationOptionId: ''`.

#### Return value (`ResolvedPrice`)

Lines 5-12:
```ts
{ price, durationMins, durationOptionId, currency, isEmployeeOverride }
```

`durationOptionId` is the literal id of the row that produced the price (or `''` for the fallback chain in 3a/3b). `isEmployeeOverride` is true only when `EmployeeServiceOption.priceOverride` or `durationOverride` was non-null (line 151-167).

### 4d. What `CreateBookingHandler` writes back to the DB

`create-booking.handler.ts:338-376` — `tx.booking.create({ data: { ..., durationOptionId: resolved.durationOptionId || null, ..., price, currency, durationMins, ..., priceSnapshot, durationMinutesSnapshot, ..., } })`.

**`durationOptionId` is persisted** to the `Booking.durationOptionId` column. This is what downstream reads (invoice, history, reschedule) use. It is the `''` → `null` form when the price came from `ServiceBookingConfig` or `Service` (line 344).

The handler also creates a **DRAFT invoice** at line 385-415 when `!dto.payAtClinic && price > 0`. The invoice math is `(subtotal − discount) × (1 + vatRate)`, using `resolved.price` (number, halalas) as `subtotal` and `OrganizationSettings.vatRate` (line 386-389). No call to `PriceResolverService` for the invoice side — the booking's `price` field is the single source of truth for what the customer is charged.

---

## 5. Step-by-step trace (the actual customer flow)

### Step 1: Customer opens `/booking`

- **Reads:** three parallel `publicFetch` calls — `GET /public/services`, `GET /public/employees`, `GET /public/branches`.
- **DB tables touched (read-only):** `Department`, `ServiceCategory`, `Service` (with joined `durationOptions WHERE employeeServiceId IS NULL` and `bookingConfigs`), `OrganizationSettings` (all from one cached query, 300s TTL), `Employee` (with `serviceIds`, `branchIds`, `availableDaysOfWeek`), `Branch`.
- **No price choice yet — only service-level defaults from the catalog.**

### Step 2: Customer picks a service (`ServicePicker`)

- **Action:** clicks a service card. `handleServiceSelect(svc)` (`page.tsx:648-669`) dispatches `SELECT_SERVICE`.
- **No server call.** The card displays the **service-level default price** (the first row in `service.durationOptions`, or `service.price` as fallback — see `service-picker.tsx:226-247`).
- **If a therapist was locked** (therapist-first deep-link): an additional `GET /public/services/:id/practitioners/:employeeId/booking-options` fires (line 660-666), which feeds the choice step.

### Step 3: Customer picks a therapist (`TherapistPicker`)

- **Action:** clicks a therapist card. `handleTherapistSelect(emp)` (`page.tsx:671-692`) dispatches `SELECT_EMPLOYEE` and immediately fires `getPractitionerBookingOptions(service.id, emp.id)`.
- **Read:** `GET /public/services/:serviceId/practitioners/:employeeId/booking-options`.
- **DB tables touched (read):** `EmployeeService` (link), `Service`, `Employee`, `ServiceBookingConfig`, then per-type `ServiceDurationOption` (either `employeeServiceId = link.id` for CUSTOM or `employeeServiceId IS NULL` for INHERIT), then optionally `EmployeeServiceOption` per option (INHERIT mode only).
- **Returned `options[].price`** is exactly what the customer will be charged — both CUSTOM and INHERIT modes surface the post-override number to the UI.

### Step 4: Customer picks a duration + deliveryType (the "choice" step)

- **Action:** `PractitionerChoicePicker.onSelect` (`page.tsx:271`, dispatched via `handleChoiceConfirm` at line 694-697).
- **Reads:** none. The price displayed was already fetched in Step 3.
- **The chosen `durationOptionId` is stored in `UiState.selectedChoice`** (line 65, `dispatchUi SET_CHOICE`).

### Step 5: Customer picks a date and slot

- **Read:** `GET /public/employees/:id/availability?date=...&durationOptionId=...&deliveryType=...` (line 612-616), plus the days probe (line 634-638).
- **DB tables touched (read):** `ServiceAvailabilityWindow`, `Booking`, `ServiceDurationOption` (duration source) — implementation in `check-availability.handler.ts` (not re-read here).

### Step 6: Customer confirms (info step) — server creates the booking

- **Action:** `onSubmitInfo` at `page.tsx:1193-1224` calls `createBooking(...)` (`POST /public/bookings`).
- **Server flow:**
  1. `CreatePublicBookingHandler.execute()` (`create-public-booking.handler.ts:34-52`) resolves `branchId` if absent and delegates with `source: 'ONLINE'`.
  2. `CreateBookingHandler.execute()` runs the validation gates in §4a, then **calls `PriceResolverService.resolve()` at line 201** with `useCustomPricing = employeeService.useCustomPricing === true`.
  3. The resolver reads in this priority (INHERIT mode, the default for non-custom practitioners):
     - **`ServiceDurationOption` (service-default, `employeeServiceId IS NULL`) for the chosen `durationOptionId`** — line 222-225.
     - **`EmployeeServiceOption` for that option** (override) — line 111-114.
     - Falls back to **`ServiceBookingConfig.price/durationMins`** if no option — line 125-129.
     - Falls back to **`Service.price/durationMins`** — line 142-148.
  4. CUSTOM mode: reads **`ServiceDurationOption WHERE employeeServiceId = link.id`** only — line 199-217.
  5. The handler writes **`Booking.durationOptionId = resolved.durationOptionId || null`**, `price`, `priceSnapshot`, `durationMinutesSnapshot` to the DB (`create-booking.handler.ts:344, 367-368`).
  6. A `DRAFT` invoice is created with `subtotal = price` (line 392) and `(subtotal - discount) × (1 + vatRate)` math.
  7. The customer is then sent to `initPayment(booking.invoiceId)` (line 1212), which `POST`s to `/public/payments/init` and returns the Moyasar `redirectUrl`.

### Step 7: Customer pays via Moyasar

- **Out of scope for this trace** — handled by the payment-callback route at `apps/website/app/booking/payment-callback/page.tsx`.

---

## 6. Display-vs-charged price consistency

### What the customer SEES (display)

The price displayed in the choice step (`PractitionerChoicePicker`, line 351) is `practitionerOptions.options[i].price`. This is exactly what `GetPractitionerBookingOptionsHandler` returned in Step 3 — which is composed as `override?.priceOverride ?? row.price` (handler line 152-155) for INHERIT mode or `row.price` for CUSTOM mode (line 113).

The summary rail (`summaryProps.resolvedPriceHalalas`, line 945-951) and the info step's `selectedPriceHalalas` (line 1174-1191) **look up the same `practitionerOptions.options[]` array** by matching `durationOptionId` and `deliveryType`. Both call sites compute the price from the **already-fetched** practitioner options — no extra server call, no second pricing pass on the client.

### What the customer is CHARGED

`resolved.price` from `PriceResolverService.resolve()` — which **must equal** the displayed price because:

1. The resolver's INHERIT-mode final price is computed as `employeeOverride?.priceOverride ?? Number(durationOption.price)` (line 156-159), exactly matching the display composition.
2. The resolver's CUSTOM-mode final price is `Number(durationOption.price)` (line 91), again matching.
3. Both the `GetPractitionerBookingOptionsHandler` and the `PriceResolverService` apply the SAME mode-routing (`useCustomPricing` is forwarded identically: from `EmployeeService.useCustomPricing`).

### Inconsistencies that COULD surface (none currently observed)

| Risk | Where | Status |
|---|---|---|
| Service picker displays `service.durationOptions[0].price` (a service-default row). If customer later picks a therapist with `EmployeeServiceOption.priceOverride` for that option, the **service-picker price is wrong** relative to the choice-step price. | `service-picker.tsx:240-247` vs `PractitionerChoicePicker` | **Minor but real**: when no therapist is chosen yet, the service card shows the "before any override" price. After the therapist is picked, the choice step refreshes to show the override. The number changes between screens. Not a bug — that's the design — but it's a two-screen price walk. |
| The `selectedPriceHalalas` fallback in `page.tsx:1183-1190` (the "backward-compat" path that reads `service.durationOptions` directly) is **never reached** when `selectedChoice` is set (line 1175-1180 already returns the practitioner-option value). Dead code in the current flow. | `page.tsx:1182-1190` | **Latent**: this fallback would only matter if the `PractitionerChoicePicker` was bypassed (e.g., an old deep-link without the choice step). |
| VAT inclusion: the resolver returns the **net** price (`price` column, halalas, integer); the website applies `grossWithVat` only for display (`page.tsx:278`). The invoice computes `vatAmt = (subtotal − discount) × vatRate` from the same net price. Display and invoice agree. | `money.ts` + `computeVat` (`finance/money.helper.ts`) | **Consistent** as long as `OrganizationSettings.vatRate` doesn't change between the customer seeing the page and the server creating the invoice. |
| Empty `durationOptionId` from `ServiceBookingConfig` fallback: when a service has `BookingConfig` rows but **no** `ServiceDurationOption` rows, the website never offers a choice step (it has nothing to pick from). The `PractitionerChoicePicker` is only rendered after `getPractitionerBookingOptions` returns at least one option. The customer would only get a fallback flow if they skip the choice step. | `page.tsx:1138` | **OK in practice** — the choice step is only entered when there are options. |
| `durationOptionId` mismatch between UI and server: if the customer deep-links into the booking via `?employeeId=` and never goes through the choice step (e.g., `?serviceId=` only with `?employeeId=` already set), the `selectedChoice` may be stale. The post at `page.tsx:1200-1207` uses `selectedChoice?.durationOptionId` which would be `undefined` in that path → backend receives `durationOptionId: undefined` → `resolve()` picks the default option for the service. This is **a legitimate flow path** in `handleServiceSelect` line 648-668 only when no therapist is locked; otherwise the choice step populates `selectedChoice` first. | `page.tsx:1200-1207` | **OK in practice** — UI ensures `selectedChoice` is set before the post fires. |

### Bottom line

**Display price = charged price for every option the customer can pick.** The website's two price sources — `practitionerOptions.options[i].price` (display) and `PriceResolverService.resolve()` (charged) — use the same mode-routing and the same precedence (override → option → config → service base). The only "drift" is the **transitional**: service picker shows the pre-therapist price, choice step shows the post-override price. This is intentional and the customer always sees the final number before confirming.

---

## 7. Mobile divergence

Spot-checked `apps/mobile/app/(client)/booking` and `apps/mobile/components/features/booking`. The mobile tree **does not** implement the choice step — mobile directly posts `serviceId/employeeId/slot/deliveryType` without a practitioner-options fetch. The mobile `createBooking` payload mirrors the website's (`createBooking` is shared in `@sawaa/api-client`), so the **server-side resolution is identical** — only the front-end UX differs (mobile lets the customer pick duration from the service-level defaults only). This means mobile customers in INHERIT mode never see a `EmployeeServiceOption` override reflected in the choice UI — but they **are** charged correctly because the resolver applies the override server-side regardless of what the UI displays.

---

## 8. Gaps and concerns

1. **`isActive = false` row leakage** — The PRACTITIONER-facing options endpoint and the resolver both filter `isActive=true`. If the dashboard deactivates a duration option while a customer is mid-flow (between Steps 3 and 6), the choice the customer picked may 404 at submit time. The current code returns a generic 400 (`'Selected duration option is not offered by this practitioner'`) at `create-booking.handler.ts:159-163`. Not a pricing bug — a UX concern.

2. **The `selectedPriceHalalas` fallback at `page.tsx:1183-1190`** is unreachable in the current wizard flow but could mask a future bug if the choice step is removed. Worth flagging.

3. **The `durationOptionId: ''` (empty string) case** — when the resolver falls back to `ServiceBookingConfig` or `Service`, it returns `''`. The frontend strips empty strings before posting (`booking.api.ts:111-112`), but the resolver at line 71-80 validates that `durationOption.deliveryType` matches the requested `deliveryType` **only when `durationOption` is found** — it does not validate the fallback case. A mismatch between the requested `deliveryType` and the booking-config's `deliveryType` in fallback mode would silently charge the wrong config's price. Low risk because the only path here is "no duration options exist for this service+deliveryType" which is a configuration edge case.

4. **Task 1's verdict (`recurring-handler-call`) doesn't impact this trace** — the customer flow reads from `ServiceDurationOption` only after the rows already exist; the duplication problem affects the dashboard write path (Task 5), not the read path here.

---

## 9. One-line summary for Task 7

**The customer-facing booking flow charges exactly what the choice step displays: `PractitionerChoicePicker` reads from `GET /public/services/:serviceId/practitioners/:employeeId/booking-options`, which composes the same priority chain (`EmployeeServiceOption.priceOverride` → `ServiceDurationOption.price` → `ServiceBookingConfig.price` → `Service.price`) that `PriceResolverService.resolve()` re-applies server-side on `POST /public/bookings` — both gated on `EmployeeService.useCustomPricing` to switch between CUSTOM (owned rows only) and INHERIT (service-defaults + override) row sets.**

---

## 10. Interface for downstream tasks (5, 6, 7)

- **For Task 5 (admin service-edit trace):** The customer-side flow proves the resolver is the single source of truth on the read path. The dashboard write path needs to keep `ServiceDurationOption` rows internally consistent (no `isActive=false` orphans, no owned-row conflicts with service-defaults) so the customer-side read returns a coherent menu.
- **For Task 6 (index):** This is the **read side** of the pricing architecture. Task 5 is the **write side**. Together they form the full lifecycle.
- **For Task 7 (synthesis):** The display-vs-charged mismatch is **not present in the current customer flow** for any chosen option. The only "drift" is the pre-therapist service-picker price transitioning to the post-override choice-step price — a UX walk, not a charge-mismatch bug.
