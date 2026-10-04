# Mobile Continuous Booking Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Booking from a clinic runs as one continuous flow (service → therapist → time → review), with the therapist profile no longer a mandatory stop.

**Architecture:** Navigation-only change inside `apps/mobile`. A pure module decides the first step and step count from the clinic's `bookingMode`; the two existing therapist lists become the "therapist step" when a `serviceId` is present; a new screen lists a SERVICES clinic's services. A `steps` route param carries the total step count so the progress header is honest.

**Tech Stack:** Expo Router, React Native, TanStack Query v5, i18next, Jest + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-10-02-mobile-continuous-booking-flow-design.md`

## Global Constraints

- All commands run as `pnpm --dir apps/mobile <cmd>`; root commands do not cover mobile.
- **No `git commit`, push or deploy.** The deployment policy requires an explicit owner command; the skill's commit steps are intentionally omitted.
- No backend, `@sawaa/shared/catalog`, payment, create-booking or auth-logic changes.
- Follow `docs/architecture/clinic-service-booking-contract.md`: find the DIRECT service only through `directServiceId`; never widen a clinic/service scope; never show the service's default price.
- Client-facing Arabic says «موعد», never «حجز»; plain copy, no superlatives.
- No hex colours or hardcoded strings in components; use Sawaa tokens and i18n keys. 350-line max per file. No `any`.
- Arabic UI uses Arabic-Indic digits consistently on the time and confirm screens; English uses Latin digits.

## Review Focus

1. Clinic `serviceId` param that does not belong to the clinic → therapist step shows the empty state, never all therapists. (Task 3)
2. DIRECT clinic whose `directServiceId` is null → CTA shows the setup-missing message and does not navigate. (Tasks 1, 2)
3. Exactly one therapist → `router.replace` (not `push`) so Back returns to the clinic/service, not into a redirect loop. (Task 3)
4. Booking-options request fails for one therapist → that card shows no price; other cards and navigation still work. (Task 3)
5. Old links without `steps` (`booking/schedule`, profile entry, auth return) → header falls back to «١ من ٢ / ٢ من ٢». (Task 4)

---

### Task 1: Flow decision module and step header

**Files:**
- Create: `apps/mobile/features/booking/booking-entry.ts`
- Test: `apps/mobile/features/booking/__tests__/booking-entry.test.ts`
- Modify: `apps/mobile/components/features/booking/BookingStepHeader.tsx`
- Modify: `apps/mobile/i18n/ar.json`, `apps/mobile/i18n/en.json` (add `booking.stepOf`)

**Interfaces — Produces:**

```ts
export type ClinicBookingEntry =
  | { kind: 'therapist'; serviceId: string; steps: 3 }
  | { kind: 'service'; steps: 4 }
  | { kind: 'misconfigured' };
export function clinicBookingEntry(clinic: { bookingMode: 'DIRECT' | 'SERVICES'; directServiceId: string | null }): ClinicBookingEntry;
export type BookingScreen = 'service' | 'therapist' | 'time' | 'confirm';
/** `steps` is the raw route param. Missing/invalid → legacy 2-step numbering. */
export function bookingStep(screen: BookingScreen, steps?: string): { step: number; total: number };
/** Total to pass on when the therapist step is skipped (single therapist). */
export function stepsAfterSkip(steps?: string): string | undefined;
```

`BookingStepHeader` props become `{ step: number; total: number; title: string; onBack: () => void }`.

- [ ] **Step 1: Write the failing test**

```ts
import { bookingStep, clinicBookingEntry, stepsAfterSkip } from '../booking-entry';

describe('clinicBookingEntry', () => {
  it('sends a DIRECT clinic to the therapist step with its internal service', () => {
    expect(clinicBookingEntry({ bookingMode: 'DIRECT', directServiceId: 's1' }))
      .toEqual({ kind: 'therapist', serviceId: 's1', steps: 3 });
  });
  it('reports a DIRECT clinic without its internal service as misconfigured', () => {
    expect(clinicBookingEntry({ bookingMode: 'DIRECT', directServiceId: null })).toEqual({ kind: 'misconfigured' });
  });
  it('sends a SERVICES clinic to the service step', () => {
    expect(clinicBookingEntry({ bookingMode: 'SERVICES', directServiceId: null })).toEqual({ kind: 'service', steps: 4 });
  });
});

describe('bookingStep', () => {
  it('numbers a 4-step flow', () => {
    expect(bookingStep('service', '4')).toEqual({ step: 1, total: 4 });
    expect(bookingStep('therapist', '4')).toEqual({ step: 2, total: 4 });
    expect(bookingStep('time', '4')).toEqual({ step: 3, total: 4 });
    expect(bookingStep('confirm', '4')).toEqual({ step: 4, total: 4 });
  });
  it('numbers a 3-step flow', () => {
    expect(bookingStep('therapist', '3')).toEqual({ step: 1, total: 3 });
    expect(bookingStep('time', '3')).toEqual({ step: 2, total: 3 });
    expect(bookingStep('confirm', '3')).toEqual({ step: 3, total: 3 });
  });
  it('falls back to the legacy two steps', () => {
    expect(bookingStep('time')).toEqual({ step: 1, total: 2 });
    expect(bookingStep('confirm', 'abc')).toEqual({ step: 2, total: 2 });
    expect(bookingStep('time', '2')).toEqual({ step: 1, total: 2 });
  });
});

describe('stepsAfterSkip', () => {
  it('drops the skipped therapist step from the total', () => {
    expect(stepsAfterSkip('4')).toBe('3');
    expect(stepsAfterSkip('3')).toBe('2');
    expect(stepsAfterSkip(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run** `pnpm --dir apps/mobile exec jest features/booking/__tests__/booking-entry.test.ts --coverage=false` — expect FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
export type ClinicBookingEntry =
  | { kind: 'therapist'; serviceId: string; steps: 3 }
  | { kind: 'service'; steps: 4 }
  | { kind: 'misconfigured' };

/** First booking step for a clinic. See docs/architecture/clinic-service-booking-contract.md. */
export function clinicBookingEntry(
  clinic: { bookingMode: 'DIRECT' | 'SERVICES'; directServiceId: string | null },
): ClinicBookingEntry {
  if (clinic.bookingMode === 'SERVICES') return { kind: 'service', steps: 4 };
  // Never fall back to a visible service when the hidden internal one is missing.
  return clinic.directServiceId
    ? { kind: 'therapist', serviceId: clinic.directServiceId, steps: 3 }
    : { kind: 'misconfigured' };
}

export type BookingScreen = 'service' | 'therapist' | 'time' | 'confirm';

function parseSteps(steps?: string): 2 | 3 | 4 {
  return steps === '4' ? 4 : steps === '3' ? 3 : 2;
}

export function bookingStep(screen: BookingScreen, steps?: string): { step: number; total: number } {
  const total = parseSteps(steps);
  const fromEnd = screen === 'confirm' ? 0 : screen === 'time' ? 1 : screen === 'therapist' ? 2 : 3;
  return { step: Math.max(1, total - fromEnd), total };
}

export function stepsAfterSkip(steps?: string): string | undefined {
  const total = parseSteps(steps);
  return steps === undefined ? undefined : String(Math.max(2, total - 1));
}
```

`BookingStepHeader`: replace the `AR_DIGITS`/`TOTAL_STEPS` constants with `step`/`total` props; render `Array.from({ length: total })` segments; text `t('booking.stepOf', { step: fmt(step), total: fmt(total) })` where `fmt = (n) => dir.isRTL ? n.toLocaleString('ar-SA') : String(n)`. Add keys `"stepOf": "الخطوة {{step}} من {{total}}"` / `"Step {{step}} of {{total}}"`. Keep `stepOfTwo` (other callers may exist in tests). Update the three callers to pass `{...bookingStep('time'|'confirm', steps)}` (`schedule.tsx` passes `step={1} total={2}`).

- [ ] **Step 4: Run** the test file plus `pnpm --dir apps/mobile typecheck` — expect PASS.

### Task 2: Service step screen and clinic entry

**Files:**
- Create: `apps/mobile/app/(client)/booking/service.tsx`, `apps/mobile/app/public-booking/service.tsx` (`export { default } from '../(client)/booking/service';`)
- Modify: `apps/mobile/app/(client)/clinic/[id].tsx`
- Modify: `apps/mobile/features/booking/guest-booking-flow.ts` (`bookingStepPath` accepts `'service'`)
- Modify: i18n (`booking.chooseService`, `booking.chooseTherapist`, `clinics.bookingSetupMissing`)
- Test: `apps/mobile/app/(client)/booking/__tests__/service-step.test.tsx`, extend `app/(client)/__tests__/clinic-detail-real-data.test.tsx`

**Interfaces:** Consumes `clinicBookingEntry`, `bookingStep`. Produces route `/(client)/booking/service` | `/public-booking/service` with params `{ clinicId, steps }`; therapist-step params `{ clinicId, serviceId, steps }` (plus `kind: 'therapists'` for the guest list).

- [ ] **Step 1: Failing tests**
  - `service-step.test.tsx`: with a SERVICES clinic of two services, both names render and no price text renders; pressing one calls `router.push` with `pathname: '/(client)/therapists'` and `params: { clinicId, serviceId, steps: '4' }` when signed in, and `'/public-list/[kind]'` + `kind: 'therapists'` as guest; unknown `clinicId` renders `clinics.notFound`; header shows «Step 1 of 4».
  - clinic test: CTA on a SERVICES clinic pushes the service route with `{ clinicId, steps: '4' }`; on a DIRECT clinic pushes the therapist list with `{ clinicId, serviceId: directServiceId, steps: '3' }`; on a DIRECT clinic with `directServiceId: null` it does not navigate and shows `clinics.bookingSetupMissing`; pressing a row in the services tab pushes the therapist list with `steps: '4'`.
- [ ] **Step 2: Run both** — expect FAIL.
- [ ] **Step 3: Implement.** `service.tsx` mirrors the clinic screen's data derivation (`useClinics`, `usePublicCatalog`, `getCategoryBookingServices` filtered by `clinic.serviceIds`), renders `BookingStepHeader` + `ServiceRow` list with the existing loading / error+retry / empty states. In `clinic/[id].tsx` replace the CTA `onPress` with a switch on `clinicBookingEntry(clinic)`, and add `steps: '4'` to `openTherapists(service.id)`.
- [ ] **Step 4: Run** both test files + typecheck — expect PASS.

### Task 3: Therapist step (both lists), profile link, single-therapist skip, per-service price

**Files:**
- Create: `apps/mobile/hooks/queries/useServicePriceFloors.ts` (export from `hooks/queries/index.ts`)
- Modify: `apps/mobile/components/features/directory/TherapistCard.tsx`, `DirectoryCard.tsx` (optional secondary action)
- Modify: `apps/mobile/app/(client)/therapists.tsx`, `apps/mobile/app/public-list/[kind].tsx`
- Modify: i18n (`therapists.viewProfile`; `therapists.searchPlaceholder` → «اكتب اسم المعالج أو التخصص»)
- Test: `apps/mobile/app/(client)/__tests__/therapist-step.test.tsx`, `apps/mobile/app/__tests__/public-therapist-step.test.tsx`

**Interfaces:**

```ts
/** Lowest practitioner price (halalas) for one service, keyed by employee id. Missing key = unknown. */
export function useServicePriceFloors(serviceId: string | undefined, employeeIds: string[]): Record<string, { price: number; currency: string }>;
// TherapistCard new optional props
servicePrice?: { price: number; currency: string } | null; // overrides minServicePrice; null hides the price
onViewProfile?: () => void;
```

- [ ] **Step 1: Failing tests** (same cases for both lists, with their own routes):
  - with `serviceId` + two therapists: pressing a card pushes the time step (`/(client)/booking/[serviceId]` | `/public-booking/[serviceId]`) with `{ serviceId, employeeId, clinicId, steps }`; pressing «View profile» pushes the profile route with `{ clinicId, serviceId }`;
  - with `serviceId` + exactly one therapist: `router.replace` is called once with the time step and `steps` = `stepsAfterSkip(steps)`; `push` is not called;
  - without `serviceId`: pressing a card still opens the profile (directory behaviour unchanged) and no «View profile» link renders;
  - `serviceId` not in the clinic's `serviceIds`: empty state, no navigation;
  - price: mocked `useServicePriceFloors` returning `{ e1: { price: 30000, currency: 'SAR' } }` → card e1 shows the formatted 300, card e2 shows no price even though its `minServicePrice` is set;
  - header shows the step from `bookingStep('therapist', steps)` when `steps` is present.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement.** `useServicePriceFloors` uses `useQueries` over `getPractitionerBookingOptions(serviceId, id)` with key `['booking-options', serviceId, id]`, `enabled: Boolean(serviceId)`, and maps successful results to the minimum `price`. Lists: when `serviceId` is set, card `onPress` goes to the time step, `onViewProfile` goes to the profile, `servicePrice={floors[item.id] ?? null}`, header becomes `BookingStepHeader` when `steps` is set. Skip effect: `useEffect` that, once therapists and clinics are loaded without error and `serviceId` is set and the unfiltered-by-search list has exactly one entry, calls `router.replace` once (guard with a ref).
- [ ] **Step 4: Run** both tests, the existing `therapists-directory-errors.test.tsx`, typecheck — expect PASS.

### Task 4: Time and confirm screens

**Files:**
- Modify: `apps/mobile/app/(client)/booking/[serviceId].tsx`, `confirm.tsx`
- Modify: `apps/mobile/features/booking/confirm-format.ts`, `guest-booking-flow.ts` (`BookingReturn.steps?: string`, encode/decode)
- Modify: i18n (`booking.chooseAppointment`, `booking.inPerson`, `booking.online`, `booking.minutes`, `booking.specialist`, `booking.clinic`)
- Test: `apps/mobile/features/booking/__tests__/confirm-format.test.ts` (new), extend `app/(client)/booking/__tests__/confirm.test.tsx`, `features/booking/__tests__/guest-booking-flow.test.ts`

- [ ] **Step 1: Failing tests**
  - `confirm-format`: `formatConfirmDate(new Date(2026, 9, 2), true)` → `'٢ أكتوبر ٢٠٢٦'` (no «٬»); `formatConfirmTime(new Date(2026, 9, 2, 17, 0), true)` → `'٥:٠٠ م'`; English unchanged (`'Oct 2, 2026'`, `'5:00 PM'`).
  - `confirm.test.tsx`: with `employeeId` resolving to a therapist and `clinicId` to a clinic, rows «Specialist» and «Clinic» render their names; the clinic row is omitted when the service row already shows the DIRECT clinic name; header uses `bookingStep('confirm', steps)`.
  - `guest-booking-flow`: `steps` survives `encodeBookingReturn` → `decodeBookingReturn`; a non-string `steps` is dropped, not rejected.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement.**
  - `confirm-format`: year `toLocaleString('ar-SA', { useGrouping: false })`; time digits through `toLocaleString('ar-SA')` when RTL.
  - Time screen: read `steps`; header `bookingStep('time', steps)`, title `t('booking.chooseAppointment')`; option title = delivery type (`booking.inPerson` / `booking.online`), second line = `opt.label ?? ''` joined with the localized minutes; add `marginTop: sawaaSpacing.lg` before the «Time» section header; forward `steps` to confirm.
  - Confirm screen: `useTherapists()` + `useClinics()` to resolve names by `employeeId` / `clinicId`; rows Clinic (`Building2`), Specialist (`UserRound`), visit type icon `Building2` in person / `Video` online; pass `steps` into `encodeBookingReturn`. Check where the auth return rebuilds confirm params and forward `steps` there.
- [ ] **Step 4: Run** the three test files + the whole `app/(client)/booking/__tests__` folder + typecheck — expect PASS.

### Task 5: Therapist profile CTA and login guest link

**Files:**
- Modify: `apps/mobile/components/features/directory/TherapistProfileView.tsx`
- Modify: `apps/mobile/app/(auth)/login.tsx`
- Modify: i18n (`employeeProfile.chooseToContinue`)
- Test: extend the existing profile test under `app/public-detail/__tests__` (or add `components/features/directory/__tests__/therapist-profile-cta.test.tsx`), extend the login test

- [ ] **Step 1: Failing tests**
  - Profile with two bookable options: opens on the services tab, CTA label is `employeeProfile.chooseToContinue` and is disabled until a row is selected, then the label is `employeeProfile.bookAppointment` and pressing calls `onBook`.
  - Profile with one option: CTA enabled immediately and calls `onBook` on first press.
  - Login rendered with a `booking` param: «Continue as guest» is absent; forgot-password and review-login links are present. Without `booking`: all three present.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement.** Profile: `activeTab = tab ?? (needsChoice || !bio ? 'services' : 'about')`; button `disabled={!bookable || needsChoice}` with the new label; remove the tab-switching branch in `onCta`. Login: wrap the guest `Pressable` in `{booking ? null : ( … )}`. No other auth change.
- [ ] **Step 4: Run** tests + typecheck — expect PASS.

### Task 6: Docs, full checks, live verification

- [ ] Update the «التطبيق» paragraph in `docs/architecture/clinic-service-booking-contract.md`: context travels clinic → (service) → practitioner → booking; the practitioner profile is optional.
- [ ] Add `docs/mobile-app/releases/2026-10-02-booking-flow.md` (behaviour, checks, limits) and align `docs/mobile-app/README.md` only if it lists per-change records.
- [ ] Run `pnpm --dir apps/mobile test`, `typecheck`, `lint`, `git diff --check`; record results.
- [ ] Live on the iOS simulator against the local backend, guest then signed-in: DIRECT clinic, SERVICES clinic (multi- and single-therapist service), profile entry with several options, Back from every step, Arabic digits on time/confirm. Screenshot each step.
- [ ] Report anything not exercised (payment, Android, physical device).
