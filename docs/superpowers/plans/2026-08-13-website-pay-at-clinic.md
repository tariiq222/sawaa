# Website Pay-at-Clinic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let every authenticated website booking choose online payment or payment at the center, with bank transfer excluded.

**Architecture:** Extend the existing public booking contract with `payAtClinic`, then reuse the core booking handler's established pay-at-center behavior. The website confirmation step owns the selected payment method and passes a boolean to the page orchestrator; online payment keeps the current Moyasar redirect, while pay-at-center completes through the existing no-invoice success branch.

**Tech Stack:** NestJS 11, Prisma 7, class-validator, Swagger/OpenAPI, Next.js 15, React 19, TypeScript, Jest, Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-13-website-pay-at-clinic-design.md`

## Global Constraints

- Offer pay-at-center for both `IN_PERSON` and `ONLINE` website bookings.
- Do not add, expose, or change bank-transfer behavior.
- Keep Moyasar as the default selected method and preserve its current redirect flow.
- Preserve all unrelated dirty website changes.
- Prisma migrations are additive and immutable; never edit an existing migration.
- Update `apps/backend/openapi.json` and dashboard generated API types after the endpoint DTO changes.
- Do not commit, push, merge, deploy, or change live production state without separate explicit authorization.

## File Structure

- `apps/backend/prisma/migrations/20260813000000_enable_pay_at_clinic/migration.sql`: enable the existing single-tenant row and future rows.
- `apps/backend/prisma/schema/organization.prisma`: align the Prisma default with the migration.
- `apps/backend/prisma/seed.ts`: make seeded environments expose the option.
- `apps/backend/src/modules/bookings/public/create-public-booking.dto.ts`: public boolean contract.
- `apps/backend/src/modules/bookings/public/create-public-booking.handler.ts`: forward the choice to the core handler.
- `apps/backend/src/modules/bookings/public/create-public-booking.handler.spec.ts`: delegation behavior.
- `apps/backend/src/api/public/bookings.controller.ts`: forward the validated DTO from HTTP.
- `apps/backend/src/api/public/bookings.controller.spec.ts`: request validation and forwarding.
- `apps/website/features/booking/booking.api.ts`: website request type and payload.
- `apps/website/features/booking/booking.api.test.ts`: serialized request coverage.
- `apps/website/features/booking/client-info-step.tsx`: accessible method selection and callback value.
- `apps/website/features/booking/client-info-step.test.tsx`: UI selection behavior.
- `apps/website/app/booking/page.tsx`: send the chosen value and preserve outcome routing.
- `apps/website/app/booking/page.test.tsx`: end-to-end component orchestration without a real provider call.
- `apps/website/features/locale/dictionary.ts`: Arabic and English payment-method copy.
- `apps/backend/openapi.json`, `apps/dashboard/lib/types/api.generated.ts`: regenerated contract artifacts.

---

### Task 1: Activate and expose pay-at-center in the public booking contract

**Interfaces:**

- Consumes: existing `CreateBookingHandler.execute(CreateBookingCommand)` and `OrganizationSettings.paymentAtClinicEnabled` guard.
- Produces: `CreatePublicBookingDto.payAtClinic?: boolean`, forwarded unchanged to `CreateBookingHandler`.

- [ ] **Step 1: Add failing DTO/controller and wrapper tests**

In `apps/backend/src/api/public/bookings.controller.spec.ts`, add a request with `payAtClinic: true` and assert:

```ts
expect(mockCreateBooking.execute).toHaveBeenCalledWith(
  expect.objectContaining({ clientId: 'client-1', payAtClinic: true }),
);
```

Also send `payAtClinic: 'true'` and expect HTTP 400, proving the contract accepts a JSON boolean only.

In `apps/backend/src/modules/bookings/public/create-public-booking.handler.spec.ts`, execute with `payAtClinic: true` and assert the delegate receives:

```ts
expect(mockDelegate.execute).toHaveBeenCalledWith(
  expect.objectContaining({ source: 'ONLINE', payAtClinic: true }),
);
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```bash
pnpm --filter=backend test -- src/api/public/bookings.controller.spec.ts src/modules/bookings/public/create-public-booking.handler.spec.ts
```

Expected: the controller rejects the unknown `payAtClinic` field or the wrapper omits it, so at least one new assertion fails.

- [ ] **Step 3: Implement the public contract**

Add to `CreatePublicBookingDto`:

```ts
@ApiPropertyOptional({
  description: 'Confirm the booking now and collect payment at the center',
  example: true,
})
@IsOptional()
@IsBoolean()
payAtClinic?: boolean;
```

Import `IsBoolean`. Forward `dto.payAtClinic` in `PublicBookingsController.create`, include it in `CreatePublicBookingCommand`, and pass it into `delegateCommand` in `CreatePublicBookingHandler`.

- [ ] **Step 4: Add the immutable activation migration**

Create `apps/backend/prisma/migrations/20260813000000_enable_pay_at_clinic/migration.sql`:

```sql
ALTER TABLE "OrganizationSettings"
  ALTER COLUMN "paymentAtClinicEnabled" SET DEFAULT true;

UPDATE "OrganizationSettings"
SET "paymentAtClinicEnabled" = true
WHERE "paymentAtClinicEnabled" = false;
```

Change the Prisma field default to `@default(true)` and ensure both seed upserts write `paymentAtClinicEnabled: true` without changing unrelated payment settings.

- [ ] **Step 5: Run focused backend tests and Prisma validation**

Run:

```bash
pnpm --filter=backend test -- src/api/public/bookings.controller.spec.ts src/modules/bookings/public/create-public-booking.handler.spec.ts src/modules/bookings/create-booking/create-booking.handler.spec.ts
pnpm --filter=backend exec prisma validate --schema prisma/schema
```

Expected: all focused tests pass and the split Prisma schema validates.

### Task 2: Serialize the website payment choice

**Interfaces:**

- Consumes: `POST /public/bookings` with optional `payAtClinic?: boolean`.
- Produces: `AuthedBookingPayload.payAtClinic?: boolean` and unchanged `createBooking(payload)` behavior.

- [ ] **Step 1: Add a failing API serialization test**

In `apps/website/features/booking/booking.api.test.ts`, call `createBooking` with `payAtClinic: true` and assert the parsed request body contains exactly that boolean alongside the existing booking fields.

- [ ] **Step 2: Run the focused website API test and confirm RED**

```bash
pnpm --filter=@sawaa/website test -- features/booking/booking.api.test.ts
```

Expected: TypeScript/test compilation fails because `AuthedBookingPayload` does not accept `payAtClinic`.

- [ ] **Step 3: Add the typed field and pass-through**

Add to `AuthedBookingPayload`:

```ts
/** Confirm immediately and collect payment at the center. */
payAtClinic?: boolean;
```

No custom request transformation is needed: `createBooking` already serializes the payload after removing only an empty `durationOptionId`.

- [ ] **Step 4: Run the API test and confirm GREEN**

Run the Task 2 focused test and expect all cases to pass.

### Task 3: Add the accessible payment-method choice to the website

**Interfaces:**

- Consumes: `ClientInfoStepProps.onSubmitInfo(payAtClinic: boolean)`.
- Produces: online selection calls `onSubmitInfo(false)`; pay-at-center calls `onSubmitInfo(true)`.

- [ ] **Step 1: Add failing component tests**

In `client-info-step.test.tsx`, render an authenticated client and verify:

```ts
expect(screen.getByRole('radio', { name: /الدفع الإلكتروني|Online payment/i })).toBeChecked();
await user.click(screen.getByRole('radio', { name: /الدفع في المركز|Pay at the center/i }));
await user.click(screen.getByRole('button', { name: /تأكيد الحجز|Confirm booking/i }));
expect(onSubmitInfo).toHaveBeenCalledWith(true);
```

Add a second case that submits the default online selection and expects `false`.

- [ ] **Step 2: Run the component test and confirm RED**

```bash
pnpm --filter=@sawaa/website test -- features/booking/client-info-step.test.tsx
```

Expected: no radio group exists and the callback receives no argument.

- [ ] **Step 3: Implement the UI and translated copy**

Change the callback prop to `(payAtClinic: boolean) => void` and add local state:

```ts
type WebsitePaymentMethod = 'ONLINE' | 'AT_CENTER';
const [paymentMethod, setPaymentMethod] = useState<WebsitePaymentMethod>('ONLINE');
```

Render a `radiogroup` inside the authenticated summary with two keyboard-accessible radio controls. Use dictionary keys for:

- payment-method heading;
- online payment label and Moyasar/card description;
- pay-at-center label and collection-at-visit description;
- dynamic CTA: “Confirm and pay” online, “Confirm booking” at center;
- show the Moyasar security note only for the online selection.

Call `onSubmitInfo(paymentMethod === 'AT_CENTER')`.

- [ ] **Step 4: Run the component tests and confirm GREEN**

Run the Task 3 test command and expect all cases to pass.

### Task 4: Wire the choice into booking orchestration

**Interfaces:**

- Consumes: boolean from `ClientInfoStep` and `AuthedBookingPayload.payAtClinic`.
- Produces: pay-at-center calls `createBooking({ ..., payAtClinic: true })` and never calls `initPayment`; online retains the current payment outcome branch.

- [ ] **Step 1: Add failing page orchestration tests**

Extend `apps/website/app/booking/page.test.tsx` using the existing mocked `ClientInfoStep` or booking flow harness:

1. Trigger `onSubmitInfo(true)`, resolve `createBooking` with `{ id: 'booking-center', status: 'CONFIRMED', invoiceId: null }`, and assert `createBooking` received `payAtClinic: true` while `initPayment` was not called.
2. Trigger `onSubmitInfo(false)`, resolve an `AWAITING_PAYMENT` response with an invoice, and assert `initPayment(invoiceId)` is still called.

- [ ] **Step 2: Run the page test and confirm RED**

```bash
pnpm --filter=@sawaa/website test -- app/booking/page.test.tsx
```

Expected: the callback cannot pass the selection or the booking payload omits `payAtClinic`.

- [ ] **Step 3: Implement the page wiring**

Change the `ClientInfoStep` callback to accept `payAtClinic`, then include:

```ts
payAtClinic,
```

in the `createBooking` payload. Leave `resolveBookingSubmitOutcome` and the Moyasar branch unchanged; a confirmed pay-at-center booking has no invoice and naturally reaches `SUBMIT_CONFIRMED`.

- [ ] **Step 4: Run page and booking outcome tests**

```bash
pnpm --filter=@sawaa/website test -- app/booking/page.test.tsx features/booking/booking-submit-outcome.test.ts
```

Expected: both payment branches pass.

### Task 5: Regenerate contracts and verify the affected surfaces

**Interfaces:**

- Consumes: completed backend DTO and website implementation.
- Produces: synchronized OpenAPI snapshot/generated dashboard types and fresh verification evidence.

- [ ] **Step 1: Regenerate contract artifacts**

Run:

```bash
pnpm openapi:sync
```

Confirm `apps/backend/openapi.json` and `apps/dashboard/lib/types/api.generated.ts` contain `payAtClinic?: boolean` for the public booking request and no bank-transfer contract changed.

- [ ] **Step 2: Run focused tests together**

Run all focused backend and website commands from Tasks 1–4 once more.

- [ ] **Step 3: Run affected typechecks**

```bash
pnpm --filter=backend typecheck
pnpm --filter=@sawaa/website typecheck
pnpm --filter=dashboard typecheck
```

Expected: zero TypeScript errors attributable to the change; report unrelated pre-existing failures separately with exact paths.

- [ ] **Step 4: Run dashboard smoke coverage**

Start required local services if they are not already healthy, then run:

```bash
pnpm --filter=dashboard run e2e:smoke
```

Expected: dashboard smoke passes, including existing booking/payment flows. Do not change production CORS or payment-provider credentials to make a local harness pass.

- [ ] **Step 5: Inspect the final diff**

Run:

```bash
git diff --check
git status --short
git diff -- apps/backend/prisma apps/backend/src/modules/bookings/public apps/backend/src/api/public/bookings.controller.ts apps/website/app/booking apps/website/features/booking apps/website/features/locale/dictionary.ts apps/backend/openapi.json apps/dashboard/lib/types/api.generated.ts
```

Confirm the diff contains no bank-transfer changes and preserves unrelated dirty website work. Stop without committing, pushing, deploying, or changing live production state.
