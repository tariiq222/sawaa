# Booking POS Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the multi-step booking wizard with a single-screen POS-style layout — a dense two-column form (all sections visible) plus a sticky live booking summary.

**Architecture:** A new `BookingPos` container renders all five selection sections at once in the larger column, and a `BookingSummary` sticky panel in the smaller column. Existing step components are reused as section bodies (they already take callback-only props). A new `useBookingFormState` replaces `useWizardState` minus all step/navigation logic.

**Tech Stack:** Next.js 15 App Router, React 19, TanStack Query v5, Tailwind 4, @sawaa/ui, Vitest.

---

## Parallelization

Tasks **2**, **3**, and **4** are INDEPENDENT of each other and MUST be dispatched in parallel after Task 1 is complete. Task 5 can run in parallel with Tasks 2/3/4 as well.

```
Task 1 → [Task 2, Task 3, Task 4, Task 5 in parallel] → (integration verification already in Task 4)
```

---

## Task 1: `useBookingFormState` hook

**Files:**
- Create: `apps/dashboard/components/features/bookings/use-booking-form-state.ts`
- Create: `apps/dashboard/components/features/bookings/use-booking-form-state.test.ts`

**Definition of done:** Vitest passes, `npm run typecheck` 0 errors, file ≤200 lines.

### Steps

- [ ] **1.1 — Write the failing test first**

  Create `apps/dashboard/components/features/bookings/use-booking-form-state.test.ts`:

  ```ts
  import { renderHook, act } from '@testing-library/react'
  import { describe, it, expect } from 'vitest'
  import { useBookingFormState } from './use-booking-form-state'

  describe('useBookingFormState', () => {
    it('starts with all fields null/false', () => {
      const { result } = renderHook(() => useBookingFormState())
      const s = result.current.state
      expect(s.clientId).toBeNull()
      expect(s.serviceId).toBeNull()
      expect(s.employeeId).toBeNull()
      expect(s.type).toBeNull()
      expect(s.date).toBeNull()
      expect(s.startTime).toBeNull()
      expect(s.payAtClinic).toBe(false)
      expect(result.current.isComplete).toBe(false)
    })

    it('selectService clears a previously-set employeeId', () => {
      const { result } = renderHook(() => useBookingFormState())
      act(() => {
        result.current.selectEmployee('emp-1', 'Ahmad')
      })
      expect(result.current.state.employeeId).toBe('emp-1')
      act(() => {
        result.current.selectService('svc-2', 'Family Therapy')
      })
      expect(result.current.state.serviceId).toBe('svc-2')
      expect(result.current.state.employeeId).toBeNull()
    })

    it('isComplete flips true once all required fields are set', () => {
      const { result } = renderHook(() => useBookingFormState())
      act(() => {
        result.current.selectClient('cli-1', 'Sara')
        result.current.selectService('svc-1', 'Counseling')
        result.current.selectEmployee('emp-1', 'Ahmad')
        result.current.selectType('in_person')
        result.current.selectDate('2026-06-01')
        result.current.selectTime('09:00')
      })
      expect(result.current.isComplete).toBe(true)
    })

    it('selectClient resets all downstream fields', () => {
      const { result } = renderHook(() => useBookingFormState())
      act(() => {
        result.current.selectClient('cli-1', 'Sara')
        result.current.selectService('svc-1', 'Counseling')
        result.current.selectEmployee('emp-1', 'Ahmad')
        result.current.selectType('in_person')
        result.current.selectDate('2026-06-01')
        result.current.selectTime('09:00')
      })
      act(() => {
        result.current.selectClient('cli-2', 'Nora')
      })
      const s = result.current.state
      expect(s.clientId).toBe('cli-2')
      expect(s.serviceId).toBeNull()
      expect(s.employeeId).toBeNull()
      expect(s.type).toBeNull()
      expect(s.date).toBeNull()
      expect(s.startTime).toBeNull()
    })

    it('reset brings everything back to initial state', () => {
      const { result } = renderHook(() => useBookingFormState())
      act(() => {
        result.current.selectClient('cli-1', 'Sara')
        result.current.selectService('svc-1', 'Counseling')
      })
      act(() => {
        result.current.reset()
      })
      expect(result.current.state.clientId).toBeNull()
      expect(result.current.state.serviceId).toBeNull()
      expect(result.current.isComplete).toBe(false)
    })
  })
  ```

- [ ] **1.2 — Run the test (expect failure)**

  ```bash
  cd apps/dashboard && npm run test -- --reporter=verbose use-booking-form-state
  ```

  Expected: import error — module does not exist yet.

- [ ] **1.3 — Implement the hook**

  Create `apps/dashboard/components/features/bookings/use-booking-form-state.ts`:

  ```ts
  import { useCallback, useState } from 'react'

  export interface BookingFormState {
    clientId: string | null
    clientName: string | null
    serviceId: string | null
    serviceName: string | null
    employeeId: string | null
    employeeName: string | null
    type: 'in_person' | 'online' | 'walk_in' | null
    durationOptionId: string | null
    durationLabel: string | null
    date: string | null      // ISO date YYYY-MM-DD
    startTime: string | null // HH:MM
    payAtClinic: boolean
    couponCode: string | null
  }

  const INITIAL_STATE: BookingFormState = {
    clientId: null,
    clientName: null,
    serviceId: null,
    serviceName: null,
    employeeId: null,
    employeeName: null,
    type: null,
    durationOptionId: null,
    durationLabel: null,
    date: null,
    startTime: null,
    payAtClinic: false,
    couponCode: null,
  }

  export function useBookingFormState() {
    const [state, setState] = useState<BookingFormState>(INITIAL_STATE)

    const isComplete = Boolean(
      state.clientId &&
        state.serviceId &&
        state.employeeId &&
        state.type &&
        state.date &&
        state.startTime,
    )

    const reset = useCallback(() => setState(INITIAL_STATE), [])

    /** Selecting a client resets all downstream selections */
    const selectClient = useCallback((clientId: string, clientName: string) => {
      setState((prev) => ({
        ...prev,
        clientId,
        clientName,
        serviceId: null,
        serviceName: null,
        employeeId: null,
        employeeName: null,
        type: null,
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
      }))
    }, [])

    /** Selecting a service resets employee/type/duration/datetime */
    const selectService = useCallback((serviceId: string, serviceName: string) => {
      setState((prev) => ({
        ...prev,
        serviceId,
        serviceName,
        employeeId: null,
        employeeName: null,
        type: null,
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
      }))
    }, [])

    /** Selecting an employee resets type/duration/datetime */
    const selectEmployee = useCallback((employeeId: string, employeeName: string) => {
      setState((prev) => ({
        ...prev,
        employeeId,
        employeeName,
        type: null,
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
      }))
    }, [])

    /** Selecting a type resets duration/datetime */
    const selectType = useCallback((type: 'in_person' | 'online' | 'walk_in') => {
      setState((prev) => ({
        ...prev,
        type,
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
      }))
    }, [])

    const selectDuration = useCallback(
      (durationOptionId: string, durationLabel: string) => {
        setState((prev) => ({
          ...prev,
          durationOptionId,
          durationLabel,
          date: null,
          startTime: null,
        }))
      },
      [],
    )

    const skipDuration = useCallback(() => {
      setState((prev) => ({
        ...prev,
        durationOptionId: null,
        durationLabel: null,
      }))
    }, [])

    /** Selecting a date resets time */
    const selectDate = useCallback((date: string) => {
      setState((prev) => ({ ...prev, date, startTime: null }))
    }, [])

    const selectTime = useCallback((startTime: string) => {
      setState((prev) => ({ ...prev, startTime }))
    }, [])

    const setPayAtClinic = useCallback((payAtClinic: boolean) => {
      setState((prev) => ({ ...prev, payAtClinic }))
    }, [])

    const setCouponCode = useCallback((couponCode: string | null) => {
      setState((prev) => ({ ...prev, couponCode }))
    }, [])

    return {
      state,
      isComplete,
      reset,
      selectClient,
      selectService,
      selectEmployee,
      selectType,
      selectDuration,
      skipDuration,
      selectDate,
      selectTime,
      setPayAtClinic,
      setCouponCode,
    }
  }
  ```

- [ ] **1.4 — Run the test (expect pass)**

  ```bash
  cd apps/dashboard && npm run test -- --reporter=verbose use-booking-form-state
  ```

  Expected: all 5 tests pass, 0 failures.

- [ ] **1.5 — Typecheck**

  ```bash
  cd apps/dashboard && npm run typecheck
  ```

  Expected: 0 errors.

- [ ] **1.6 — Commit**

  ```bash
  git add apps/dashboard/components/features/bookings/use-booking-form-state.ts \
          apps/dashboard/components/features/bookings/use-booking-form-state.test.ts
  git commit -m "feat(bookings): add useBookingFormState hook (POS redesign step 1)"
  ```

---

## Task 2: `BookingSummary` component

**Files:**
- Create: `apps/dashboard/components/features/bookings/booking-summary.tsx`

**Note:** This is pure UI assembly — no unit-testable logic independent of rendering. Verification is via typecheck, not a unit test.

**Definition of done:** `npm run typecheck` 0 errors, file ≤300 lines, all strings via `t()`.

**Dependencies (from Task 1):** Import `BookingFormState` from `./use-booking-form-state`.

### Steps

- [ ] **2.1 — Read reference files**

  Before writing, read the existing `step-confirm.tsx` to extract:
  - The `getTypeLabel` map (maps `'in_person' | 'online' | 'walk_in'` to translation keys).
  - The `formatDate`/`formatTime` usage pattern via `useOrganizationConfig`.
  - The pay-at-clinic toggle pattern (Switch + label).
  - The coupon Input field pattern.

  ```bash
  cat apps/dashboard/components/features/bookings/wizard-steps/step-confirm.tsx
  ```

- [ ] **2.2 — Implement `BookingSummary`**

  Create `apps/dashboard/components/features/bookings/booking-summary.tsx`:

  ```tsx
  'use client'

  import { Button, Input, Switch } from '@sawaa/ui'
  import { useLocale } from '@/components/locale-provider'
  import { useOrganizationConfig } from '@/hooks/use-organization-config'
  import type { BookingFormState } from './use-booking-form-state'

  const TYPE_LABEL_KEYS: Record<string, string> = {
    in_person: 'bookings.type.inPerson',
    online: 'bookings.type.online',
    walk_in: 'bookings.type.walkIn',
  }

  interface BookingSummaryProps {
    state: BookingFormState
    isComplete: boolean
    submitting: boolean
    onSubmit: () => void
    onTogglePayAtClinic: (value: boolean) => void
    onCouponChange: (code: string | null) => void
  }

  export function BookingSummary({
    state,
    isComplete,
    submitting,
    onSubmit,
    onTogglePayAtClinic,
    onCouponChange,
  }: BookingSummaryProps) {
    const { t } = useLocale()
    const { formatDate, formatTime } = useOrganizationConfig()

    const typeLabel = state.type ? t(TYPE_LABEL_KEYS[state.type] ?? state.type) : null

    const datetimeLabel =
      state.date && state.startTime
        ? `${formatDate(state.date)} — ${formatTime(state.startTime)}`
        : null

    return (
      <div className="flex flex-col gap-4 rounded-xl border border-[--border] bg-[--surface] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[--foreground-muted]">
          {t('bookings.pos.summary.title')}
        </h2>

        {/* Summary rows */}
        <dl className="flex flex-col gap-3 text-sm">
          <SummaryRow
            label={t('bookings.pos.section.client')}
            value={state.clientName}
          />
          <SummaryRow
            label={t('bookings.pos.section.service')}
            value={state.serviceName}
          />
          <SummaryRow
            label={t('bookings.pos.section.employee')}
            value={state.employeeName}
          />
          <SummaryRow
            label={t('bookings.pos.section.typeDuration')}
            value={
              typeLabel
                ? state.durationLabel
                  ? `${typeLabel} — ${state.durationLabel}`
                  : typeLabel
                : null
            }
          />
          <SummaryRow
            label={t('bookings.pos.section.datetime')}
            value={datetimeLabel}
          />
        </dl>

        <hr className="border-[--border]" />

        {/* Pay at clinic toggle */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-[--foreground]">
            {t('bookings.payAtClinic')}
          </span>
          <Switch
            checked={state.payAtClinic}
            onCheckedChange={onTogglePayAtClinic}
          />
        </div>

        {/* Coupon code */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[--foreground-muted]">
            {t('bookings.couponCode')}
          </label>
          <Input
            value={state.couponCode ?? ''}
            onChange={(e) =>
              onCouponChange(e.target.value.trim() || null)
            }
            placeholder={t('bookings.couponPlaceholder')}
          />
        </div>

        {/* Confirm button */}
        <Button
          className="w-full"
          disabled={!isComplete || submitting}
          onClick={onSubmit}
        >
          {submitting
            ? t('bookings.pos.submitting')
            : t('bookings.confirmBooking')}
        </Button>
      </div>
    )
  }

  function SummaryRow({
    label,
    value,
  }: {
    label: string
    value: string | null | undefined
  }) {
    return (
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-[--foreground-muted]">{label}</dt>
        <dd
          className={
            value
              ? 'font-medium text-[--foreground]'
              : 'text-[--foreground-muted] opacity-50'
          }
        >
          {value ?? '—'}
        </dd>
      </div>
    )
  }
  ```

- [ ] **2.3 — Typecheck verification**

  ```bash
  cd apps/dashboard && npm run typecheck
  ```

  Expected: 0 errors. If errors, fix them before proceeding.

- [ ] **2.4 — Commit**

  ```bash
  git add apps/dashboard/components/features/bookings/booking-summary.tsx
  git commit -m "feat(bookings): add BookingSummary sticky panel (POS redesign step 2)"
  ```

---

## Task 3: `BookingPos` container

**Files:**
- Create: `apps/dashboard/components/features/bookings/booking-pos.tsx`

**Note:** Pure UI assembly — verification via typecheck, not a unit test.

**Definition of done:** `npm run typecheck` 0 errors, file ≤300 lines, all strings via `t()`, logical RTL classes only, `@hugeicons` icons only.

**Dependencies (from Task 1):** Import `useBookingFormState` from `./use-booking-form-state`.
**Dependencies (from Task 2):** Import `BookingSummary` from `./booking-summary`.

### Steps

- [ ] **3.1 — Read wiring context**

  Read the current `booking-wizard.tsx` to extract the `handleSubmit` payload shape and the `createMut` / `useBranches` / `useBookingSettings` usage pattern:

  ```bash
  cat apps/dashboard/components/features/bookings/booking-wizard.tsx
  ```

  Also read the step component prop signatures to confirm they haven't changed since the brief:

  ```bash
  head -40 apps/dashboard/components/features/bookings/booking-client-step.tsx
  head -40 apps/dashboard/components/features/bookings/wizard-steps/step-service.tsx
  head -40 apps/dashboard/components/features/bookings/wizard-steps/step-employee.tsx
  head -40 apps/dashboard/components/features/bookings/wizard-steps/step-type-duration.tsx
  head -40 apps/dashboard/components/features/bookings/wizard-steps/step-datetime.tsx
  ```

- [ ] **3.2 — Implement `BookingPos`**

  Create `apps/dashboard/components/features/bookings/booking-pos.tsx`:

  ```tsx
  'use client'

  import { Cancel01Icon } from '@hugeicons/react'
  import { toast } from 'sonner'
  import { useLocale } from '@/components/locale-provider'
  import { useBranches } from '@/hooks/use-branches'
  import { useBookingSettings } from '@/hooks/use-booking-settings'
  import { useCreateBooking } from '@/hooks/use-bookings'
  import { ClientStep } from './booking-client-step'
  import { StepService } from './wizard-steps/step-service'
  import { StepEmployee } from './wizard-steps/step-employee'
  import { StepTypeDuration } from './wizard-steps/step-type-duration'
  import { StepDatetime } from './wizard-steps/step-datetime'
  import { BookingSummary } from './booking-summary'
  import { useBookingFormState } from './use-booking-form-state'

  interface BookingPosProps {
    onSuccess: () => void
    onCancel: () => void
  }

  export function BookingPos({ onSuccess, onCancel }: BookingPosProps) {
    const { t } = useLocale()
    const { branches } = useBranches()
    const { settings } = useBookingSettings()
    const { mutate: createMut, isPending: submitting } = useCreateBooking()

    const mainBranch = branches?.find((b) => b.isMain) ?? branches?.[0]
    const maxAdvanceDays = settings?.maxAdvanceBookingDays ?? 90

    const {
      state,
      isComplete,
      reset,
      selectClient,
      selectService,
      selectEmployee,
      selectType,
      selectDuration,
      skipDuration,
      selectDate,
      selectTime,
      setPayAtClinic,
      setCouponCode,
    } = useBookingFormState()

    const handleSubmit = () => {
      if (!isComplete || !mainBranch) return

      createMut(
        {
          clientId: state.clientId!,
          employeeId: state.employeeId!,
          serviceId: state.serviceId!,
          type: state.type!,
          durationOptionId: state.durationOptionId ?? undefined,
          date: state.date!,
          startTime: state.startTime!,
          payAtClinic: state.payAtClinic,
          branchId: mainBranch.id,
          couponCode: state.couponCode ?? undefined,
        },
        {
          onSuccess: () => {
            reset()
            onSuccess()
          },
          onError: (err) => {
            toast.error(err.message ?? t('common.errorGeneric'))
          },
        },
      )
    }

    const needsService = !state.serviceId
    const needsEmployee = !state.employeeId
    const canShowTypeDuration = Boolean(state.serviceId)
    const canShowDatetime = Boolean(state.employeeId && state.serviceId && state.type)

    return (
      <div className="flex flex-col gap-4">
        {/* Top bar with close button */}
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-[--foreground]">
            {t('bookings.newBooking')}
          </h1>
          <button
            type="button"
            aria-label={t('common.close')}
            className="rounded-md p-1 text-[--foreground-muted] hover:bg-[--surface-hover] hover:text-[--foreground]"
            onClick={onCancel}
          >
            <Cancel01Icon size={18} />
          </button>
        </div>

        {/* Two-column POS layout */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          {/* Form column (~2/3) */}
          <div className="flex flex-1 flex-col gap-3 md:basis-2/3">
            {/* Section: client */}
            <PosSection label={t('bookings.pos.section.client')}>
              <ClientStep onSelect={selectClient} />
            </PosSection>

            {/* Section: service */}
            <PosSection label={t('bookings.pos.section.service')}>
              <StepService onSelect={selectService} />
            </PosSection>

            {/* Section: employee */}
            <PosSection label={t('bookings.pos.section.employee')}>
              <StepEmployee
                serviceId={state.serviceId ?? undefined}
                onSelect={selectEmployee}
              />
            </PosSection>

            {/* Section: type + duration */}
            <PosSection label={t('bookings.pos.section.typeDuration')}>
              {canShowTypeDuration ? (
                <StepTypeDuration
                  employeeId={state.employeeId ?? undefined}
                  serviceId={state.serviceId!}
                  selectedType={state.type}
                  selectedDurationOptionId={state.durationOptionId}
                  onSelectType={selectType}
                  onSelectDuration={selectDuration}
                  onSkipDuration={skipDuration}
                />
              ) : (
                <PosSectionHint hint={t('bookings.pos.hint.needService')} />
              )}
            </PosSection>

            {/* Section: datetime */}
            <PosSection label={t('bookings.pos.section.datetime')}>
              {canShowDatetime ? (
                <StepDatetime
                  employeeId={state.employeeId!}
                  serviceId={state.serviceId!}
                  bookingType={state.type!}
                  durationOptionId={state.durationOptionId ?? undefined}
                  selectedDate={state.date}
                  selectedTime={state.startTime}
                  onSelectDate={selectDate}
                  onSelectTime={selectTime}
                  maxAdvanceDays={maxAdvanceDays}
                />
              ) : (
                <PosSectionHint hint={t('bookings.pos.hint.needEmployee')} />
              )}
            </PosSection>
          </div>

          {/* Summary column (~1/3, sticky) */}
          <div className="md:basis-1/3 md:sticky md:top-4 md:self-start">
            <BookingSummary
              state={state}
              isComplete={isComplete}
              submitting={submitting}
              onSubmit={handleSubmit}
              onTogglePayAtClinic={setPayAtClinic}
              onCouponChange={setCouponCode}
            />
          </div>
        </div>
      </div>
    )
  }

  function PosSection({
    label,
    children,
  }: {
    label: string
    children: React.ReactNode
  }) {
    return (
      <div className="rounded-xl border border-[--border] bg-[--surface] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[--foreground-muted]">
          {label}
        </p>
        {children}
      </div>
    )
  }

  function PosSectionHint({ hint }: { hint: string }) {
    return (
      <p className="py-2 text-sm text-[--foreground-muted] opacity-60">{hint}</p>
    )
  }
  ```

- [ ] **3.3 — Typecheck verification**

  ```bash
  cd apps/dashboard && npm run typecheck
  ```

  Expected: 0 errors. Fix any import path or prop mismatches before proceeding.

- [ ] **3.4 — Commit**

  ```bash
  git add apps/dashboard/components/features/bookings/booking-pos.tsx
  git commit -m "feat(bookings): add BookingPos two-column POS container (POS redesign step 3)"
  ```

---

## Task 4: Wire into `booking-create-view.tsx` + delete dead wizard files

**Files modified:**
- `apps/dashboard/components/features/bookings/booking-create-view.tsx`

**Files deleted:**
- `apps/dashboard/components/features/bookings/booking-wizard.tsx`
- `apps/dashboard/components/features/bookings/use-wizard-state.ts`
- `apps/dashboard/components/features/bookings/wizard-steps/step-choose-path.tsx`
- `apps/dashboard/components/features/bookings/wizard-steps/step-confirm.tsx`
- `apps/dashboard/components/features/bookings/wizard-steps/step-scheduling.tsx`

**Definition of done:** `npm run typecheck` 0 errors, `npm run lint` 0 errors, `npm run i18n:verify` passes, grep for deleted file names returns clean.

### Steps

- [ ] **4.1 — Read `booking-create-view.tsx`**

  ```bash
  cat apps/dashboard/components/features/bookings/booking-create-view.tsx
  ```

  Understand the outer card wrapper, how `onSuccess` and `onCancel` are threaded in, and any `max-w` constraint applied to the wizard.

- [ ] **4.2 — Modify `booking-create-view.tsx`**

  Replace the `<BookingWizard ...>` render with `<BookingPos onSuccess={onSuccess} onCancel={onCancel}>`, update the import line, and remove any `max-w-*` width cap class from the outer container (the POS layout is wide). Keep the outer card wrapper intact.

  The diff should be minimal — only:
  1. Remove the `BookingWizard` import, add `BookingPos` import.
  2. Swap the rendered component.
  3. Remove the `max-w-*` constraint class (if any) from the wrapper `div`/`Card`.

- [ ] **4.3 — Delete the dead wizard files**

  ```bash
  git rm apps/dashboard/components/features/bookings/booking-wizard.tsx
  git rm apps/dashboard/components/features/bookings/use-wizard-state.ts
  git rm apps/dashboard/components/features/bookings/wizard-steps/step-choose-path.tsx
  git rm apps/dashboard/components/features/bookings/wizard-steps/step-confirm.tsx
  git rm apps/dashboard/components/features/bookings/wizard-steps/step-scheduling.tsx
  ```

- [ ] **4.4 — Verify no remaining imports of deleted files**

  ```bash
  grep -rn "booking-wizard\|use-wizard-state\|step-choose-path\|step-confirm\|step-scheduling" \
    apps/dashboard/app \
    apps/dashboard/components \
    apps/dashboard/hooks
  ```

  Expected: **no output** (zero matches). If matches appear, fix those files before proceeding.

- [ ] **4.5 — Typecheck**

  ```bash
  cd apps/dashboard && npm run typecheck
  ```

  Expected: 0 errors.

- [ ] **4.6 — Lint**

  ```bash
  cd apps/dashboard && npm run lint
  ```

  Expected: 0 errors.

- [ ] **4.7 — i18n parity**

  ```bash
  cd apps/dashboard && npm run i18n:verify
  ```

  Expected: exits 0, AR/EN keys are in parity.

- [ ] **4.8 — Commit**

  ```bash
  git add apps/dashboard/components/features/bookings/booking-create-view.tsx
  git commit -m "feat(bookings): wire BookingPos into create-view, delete dead wizard files (POS redesign step 4)"
  ```

---

## Task 5: Translation keys

**Files:**
- `apps/dashboard/lib/translations/ar.bookings.ts`
- `apps/dashboard/lib/translations/en.bookings.ts`

**Definition of done:** `npm run i18n:verify` exits 0, both files within the 300-line translation limit.

### Steps

- [ ] **5.1 — Read the existing translation files**

  ```bash
  cat apps/dashboard/lib/translations/ar.bookings.ts
  cat apps/dashboard/lib/translations/en.bookings.ts
  ```

  Find the last key in each file to know where to append, and confirm the existing `bookings.payAtClinic`, `bookings.couponCode`, `bookings.couponPlaceholder`, `bookings.confirmBooking` keys are already present (the wizard used them). If they are missing, add them in step 5.2.

- [ ] **5.2 — Add new POS keys to both files**

  Append the following key/value pairs to `ar.bookings.ts` (Arabic values):

  ```ts
  // POS section headers
  'bookings.pos.section.client': 'المستفيد',
  'bookings.pos.section.service': 'الخدمة',
  'bookings.pos.section.employee': 'الممارس',
  'bookings.pos.section.typeDuration': 'النوع والمدة',
  'bookings.pos.section.datetime': 'الموعد',

  // POS summary panel
  'bookings.pos.summary.title': 'ملخص الحجز',

  // POS dependency hints
  'bookings.pos.hint.needService': 'اختر الخدمة أولاً لعرض الخيارات',
  'bookings.pos.hint.needEmployee': 'اختر الخدمة والممارس والنوع لعرض المواعيد المتاحة',

  // POS submit states
  'bookings.pos.submitting': 'جارٍ الحجز...',
  ```

  Append the following key/value pairs to `en.bookings.ts` (English values):

  ```ts
  // POS section headers
  'bookings.pos.section.client': 'Client',
  'bookings.pos.section.service': 'Service',
  'bookings.pos.section.employee': 'Practitioner',
  'bookings.pos.section.typeDuration': 'Type & Duration',
  'bookings.pos.section.datetime': 'Date & Time',

  // POS summary panel
  'bookings.pos.summary.title': 'Booking Summary',

  // POS dependency hints
  'bookings.pos.hint.needService': 'Select a service first to see options',
  'bookings.pos.hint.needEmployee': 'Select service, practitioner, and type to view available slots',

  // POS submit states
  'bookings.pos.submitting': 'Booking...',
  ```

  Also ensure these common keys exist in both files (add only if missing — do NOT duplicate):
  - `bookings.newBooking` — AR: `حجز جديد` / EN: `New Booking`
  - `bookings.payAtClinic` — AR: `الدفع في العيادة` / EN: `Pay at clinic`
  - `bookings.couponCode` — AR: `كود الكوبون` / EN: `Coupon code`
  - `bookings.couponPlaceholder` — AR: `أدخل كود الكوبون` / EN: `Enter coupon code`
  - `bookings.confirmBooking` — AR: `تأكيد الحجز` / EN: `Confirm Booking`

- [ ] **5.3 — Verify parity**

  ```bash
  cd apps/dashboard && npm run i18n:verify
  ```

  Expected: exits 0. If drift reported, add the missing key to whichever file is behind and re-run.

- [ ] **5.4 — Commit**

  ```bash
  git add apps/dashboard/lib/translations/ar.bookings.ts \
          apps/dashboard/lib/translations/en.bookings.ts
  git commit -m "feat(bookings): add POS translation keys, AR/EN parity (POS redesign step 5)"
  ```

---

## Self-Review

This plan covers the full scope of the design spec at `docs/superpowers/specs/2026-05-17-booking-pos-redesign-design.md`:

| Spec requirement | Covered in |
|---|---|
| Single-screen two-column POS layout | Task 3 (`BookingPos`) |
| All five sections visible simultaneously | Task 3 — 5 `PosSection` cards |
| Sticky live booking summary | Task 2 (`BookingSummary`) + Task 3 summary column |
| No next/back navigation buttons | Task 1 (`useBookingFormState` — no step/navigation state) |
| Dependency hints (needService / needEmployee) | Task 3 — `canShowTypeDuration` / `canShowDatetime` guards + hints |
| Reuse existing step components as section bodies | Task 3 — all 5 step components wired without internal modification |
| `useWizardState` replaced by `useBookingFormState` | Task 1 |
| `flowOrder`/`chosenPath`/`StepChoosePath` removed | Task 4 (deleted files) + Task 1 (no chosenPath field) |
| `createMut` payload unchanged | Task 3 `handleSubmit` mirrors existing wizard payload shape |
| `mainBranch` + `maxAdvanceBookingDays` wired | Task 3 |
| Pay-at-clinic toggle + coupon code | Task 2 |
| Confirm button disabled until all required fields set | Task 2 (`!isComplete || submitting`) |
| `toast.error` on create failure | Task 3 `onError` handler |
| `reset()` + `onSuccess()` on create success | Task 3 `onSuccess` handler |
| RTL logical classes only | Enforced throughout Tasks 2/3 — `md:flex-row`, `ps-`/`pe-` where spacing needed |
| Tokens only, no hex | All color references use `--token` CSS custom properties |
| `@hugeicons` only | `Cancel01Icon` from `@hugeicons/react` in Task 3 top bar |
| All strings via `t()` | Every label string uses `t('bookings.pos.*')` keys added in Task 5 |
| AR/EN i18n parity | Task 5 adds keys to both files; Task 4 runs `i18n:verify` |
| File size ≤350 lines (hooks ≤200, components ≤300) | Hook: ~130 lines; BookingSummary: ~100 lines; BookingPos: ~160 lines |
| Typecheck 0 errors | Verified in Tasks 1/2/3/4 |
| Lint 0 errors | Verified in Task 4 |
| Dead files deleted | Task 4 deletes wizard.tsx, use-wizard-state.ts, step-choose-path, step-confirm, step-scheduling |
| No remaining imports of deleted files | Task 4.4 grep verification |
