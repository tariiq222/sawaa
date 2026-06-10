'use client';

import { useEffect, useMemo, useReducer, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { reduce, INITIAL_WIZARD_STATE, WizardStep } from '@sawaa/shared';
import type { Service, EmployeeWithUser } from '@sawaa/shared';
import { ServicePicker } from '@/features/booking/service-picker';
import { TherapistPicker } from '@/features/booking/therapist-picker';
import { SlotPicker } from '@/features/booking/slot-picker';
import { BranchStep } from '@/features/booking/branch-step';
import { ClientInfoStep } from '@/features/booking/client-info-step';
import { DateStrip } from '@/features/booking/date-strip';
import { publicFetch } from '@/lib/public-fetch';
import {
  getPublicAvailability,
  getPublicAvailabilityDays,
  getPublicBranches,
  createBooking,
  initPayment,
  type PublicBranch,
} from '@/features/booking/booking.api';
import { PaymentRedirect } from '@/features/payment/payment-redirect';
import { BookingSkeleton } from '@/features/booking/booking-skeleton';
import { useT } from '@/features/locale/locale-provider';

function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The visible flow order depends on where the user entered:
 *
 *  - SERVICE entry (no params, or ?serviceId=…): Service → Therapist → Branch? → Time → Info
 *  - THERAPIST entry (?employeeId=…):              Therapist → Branch? → Service → Time → Info
 *
 * The underlying state machine still always needs `service` set before
 * `employee`. We bridge by buffering whichever selection arrives first and
 * dispatching them in the canonical order once both are known.
 */
type EntryPoint = 'service' | 'therapist';

type WizardScreen = 'service' | 'therapist' | 'branch' | 'slot' | 'info';

type UiState = {
  entryPoint: EntryPoint;
  /** True while the dedicated branch screen is shown. */
  awaitingBranch: boolean;
  /** Employee picked on this device but not yet dispatched to the state machine. */
  pendingEmployee: EmployeeWithUser | null;
  /** Employee carried over from a deep-link until a service is picked. */
  lockedEmployee: EmployeeWithUser | null;
  selectedBranch: PublicBranch | null;
  selectedDate: string;
  selectedChoice: { durationOptionId: string; deliveryType: 'IN_PERSON' | 'ONLINE' } | null;
  isSubmitting: boolean;
  submitError: string | null;
  redirectUrl: string | null;
  bookingId: string | null;
};

type UiAction =
  | { type: 'SET_ENTRY_POINT'; entryPoint: EntryPoint }
  | { type: 'LOCK_EMPLOYEE'; employee: EmployeeWithUser }
  | { type: 'CLEAR_LOCKED_EMPLOYEE' }
  | { type: 'START_BRANCH_PICK'; employee: EmployeeWithUser }
  | { type: 'OPEN_INITIAL_BRANCH_PICK' }
  | { type: 'PICK_BRANCH'; branch: PublicBranch }
  | { type: 'CANCEL_BRANCH_PICK' }
  | { type: 'SET_DATE'; date: string }
  | { type: 'SET_CHOICE'; choice: { durationOptionId: string; deliveryType: 'IN_PERSON' | 'ONLINE' } | null }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'SUBMIT_DONE'; bookingId: string; redirectUrl: string };

const INITIAL_UI_STATE: UiState = {
  entryPoint: 'service',
  awaitingBranch: false,
  pendingEmployee: null,
  lockedEmployee: null,
  selectedBranch: null,
  selectedDate: todayLocalIso(),
  selectedChoice: null,
  isSubmitting: false,
  submitError: null,
  redirectUrl: null,
  bookingId: null,
};

function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'SET_ENTRY_POINT':
      return { ...state, entryPoint: action.entryPoint };
    case 'LOCK_EMPLOYEE':
      return { ...state, lockedEmployee: action.employee };
    case 'CLEAR_LOCKED_EMPLOYEE':
      return { ...state, lockedEmployee: null };
    case 'START_BRANCH_PICK':
      return { ...state, awaitingBranch: true, pendingEmployee: action.employee };
    case 'OPEN_INITIAL_BRANCH_PICK':
      return { ...state, awaitingBranch: true, pendingEmployee: null };
    case 'PICK_BRANCH':
      return { ...state, selectedBranch: action.branch, awaitingBranch: false };
    case 'CANCEL_BRANCH_PICK':
      return { ...state, awaitingBranch: false, pendingEmployee: null };
    case 'SET_DATE':
      return { ...state, selectedDate: action.date };
    case 'SET_CHOICE':
      return { ...state, selectedChoice: action.choice };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, submitError: null };
    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, submitError: action.error };
    case 'SUBMIT_DONE':
      return {
        ...state,
        isSubmitting: false,
        bookingId: action.bookingId,
        redirectUrl: action.redirectUrl,
      };
    default:
      return state;
  }
}

/**
 * Compute the screen sequence shown in the stepper for a given entry point.
 * Branch is the first step (services + therapists vary per branch) and is only
 * included when multiple branches exist.
 */
function buildFlow(entryPoint: EntryPoint, hasBranchStep: boolean): WizardScreen[] {
  const branch: WizardScreen[] = hasBranchStep ? ['branch'] : [];
  if (entryPoint === 'therapist') {
    return [...branch, 'therapist', 'service', 'slot', 'info'];
  }
  return [...branch, 'service', 'therapist', 'slot', 'info'];
}

function IconButton({
  onClick,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="grid place-items-center h-10 w-10 rounded-full cursor-pointer transition-all"
      style={{
        background: 'white',
        color: 'var(--sw-secondary-700)',
        border: '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 14%, transparent)',
        boxShadow: 'var(--sw-shadow-xs)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--sw-secondary-700)';
        e.currentTarget.style.color = 'var(--sw-secondary-900)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--sw-secondary-700) 14%, transparent)';
        e.currentTarget.style.color = 'var(--sw-secondary-700)';
      }}
    >
      {children}
    </button>
  );
}

function ProgressBar({ current, labels }: { current: number; labels: string[] }) {
  const total = labels.length;
  const startPct = total > 0 ? (0.5 / total) * 100 : 0;
  const endPct = total > 0 ? ((current + 0.5) / total) * 100 : 0;
  const filledPct = Math.max(0, endPct - startPct);
  const trackPct = total > 0 ? ((total - 1) / total) * 100 : 0;
  return (
    <nav aria-label="Booking progress" className="mb-10">
      <ol
        className="relative grid gap-2"
        dir="rtl"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        <div
          aria-hidden="true"
          className="absolute top-3.5 h-px"
          style={{
            background: 'color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)',
            insetInlineStart: `${startPct}%`,
            width: `${trackPct}%`,
          }}
        />
        <div
          aria-hidden="true"
          className="absolute top-3.5 h-px transition-[width] duration-500 ease-out"
          style={{
            background: 'var(--primary)',
            insetInlineStart: `${startPct}%`,
            width: `${filledPct}%`,
          }}
        />
        {labels.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={`step-${i}`}
              className="relative flex flex-col items-center gap-2 min-w-0"
              aria-current={active ? 'step' : undefined}
            >
              <span
                className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-[0.6875rem] font-bold tabular-nums transition-all duration-300"
                style={{
                  background: done ? 'var(--primary)' : '#FFFFFF',
                  color: done
                    ? '#fff'
                    : active
                      ? 'var(--primary)'
                      : 'color-mix(in srgb, var(--sw-secondary-700) 35%, var(--sw-neutral-400))',
                  border: active
                    ? '2px solid var(--primary)'
                    : done
                      ? '2px solid var(--primary)'
                      : '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 18%, transparent)',
                  boxShadow: active
                    ? `0 4px 12px -4px color-mix(in srgb, var(--primary) 40%, transparent)`
                    : 'none',
                }}
              >
                {done ? (
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`text-[0.6875rem] sm:text-xs truncate max-w-full text-center transition-colors duration-300 ${active ? 'inline' : 'hidden sm:inline'}`}
                style={{
                  fontWeight: active ? 700 : 600,
                  color: active
                    ? 'var(--sw-secondary-900)'
                    : done
                      ? 'var(--sw-secondary-700)'
                      : 'var(--sw-secondary-500)',
                  letterSpacing: '-0.005em',
                }}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function BookingWizardInner() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectEmployeeId = searchParams.get('employeeId');
  const preselectServiceId = searchParams.get('serviceId');
  const preselectCategoryId = searchParams.get('categoryId');
  const preselectBranchId = searchParams.get('branchId');
  const [state, dispatch] = useReducer(reduce, INITIAL_WIZARD_STATE);
  const [ui, dispatchUi] = useReducer(uiReducer, {
    ...INITIAL_UI_STATE,
    // Entry point is decided from URL — if we landed with ?employeeId= and no
    // ?serviceId=, treat the therapist as the anchor of the flow.
    entryPoint: preselectEmployeeId && !preselectServiceId ? 'therapist' : 'service',
  });
  const didPreselectRef = useRef(false);
  const [preselectDone, setPreselectDone] = useState(false);
  const {
    entryPoint,
    awaitingBranch,
    pendingEmployee,
    lockedEmployee,
    selectedBranch,
    selectedDate,
    selectedChoice,
    isSubmitting,
    submitError,
    redirectUrl,
    bookingId,
  } = ui;

  const { data: employees = [], isLoading: loadingEmployees, error: employeesError } = useQuery({
    queryKey: ['public', 'employees'],
    queryFn: async () => {
      const json = await publicFetch<{ data?: EmployeeWithUser[] } | EmployeeWithUser[]>('/public/employees');
      return Array.isArray(json) ? json : (json.data ?? []);
    },
  });

  const { data: catalog = { services: [], categories: [], vatRate: 0 }, isLoading: loadingServices, error: servicesError } = useQuery({
    queryKey: ['public', 'catalog'],
    queryFn: async () => {
      type Cat = { id: string; nameAr: string; nameEn: string };
      type CatalogShape = { services: Service[]; categories: Cat[]; vatRate?: number };
      const json = await publicFetch<{ data?: CatalogShape } | CatalogShape>('/public/services');
      const payload = 'data' in json && json.data ? json.data : (json as CatalogShape);
      return {
        services: payload.services ?? [],
        categories: payload.categories ?? [],
        // Tolerate older cached responses that predate the vatRate field.
        vatRate: payload.vatRate ?? 0,
      };
    },
  });
  const services = catalog.services;
  const categories = catalog.categories;
  // Fractional org VAT rate (0.15 = 15%) — display-only: the backend computes
  // the real invoice; we just show gross amounts so the customer isn't surprised.
  const vatRate = catalog.vatRate ?? 0;

  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['public', 'branches'],
    queryFn: getPublicBranches,
  });

  const loadingData = loadingEmployees || loadingServices || loadingBranches;
  const loadError = employeesError?.message ?? servicesError?.message ?? null;
  const hasBranchStep = branches.length > 1;

  // Deep-link handling
  //
  // - `?serviceId=` only         → select service, land on THERAPIST.
  // - `?employeeId=` only        → lock therapist; entry=therapist; user picks
  //                                 branch first (if multi) then service.
  // - both                        → select service, then apply therapist and go
  //                                 straight to branch/slot.
  useEffect(() => {
    if (didPreselectRef.current) return;
    if (loadingData) return;
    if (!preselectEmployeeId && !preselectServiceId && !preselectBranchId) {
      didPreselectRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot init guarded by ref
      setPreselectDone(true);
      return;
    }
    const svc = preselectServiceId
      ? services.find((s) => s.id === preselectServiceId)
      : null;
    const emp = preselectEmployeeId
      ? employees.find((e) => e.id === preselectEmployeeId)
      : null;

    // Branch resolution priority:
    //   1) explicit ?branchId= in the URL
    //   2) the therapist's only branch (deep-link from therapist profile)
    //   3) the single branch in the system (when there's only one anyway)
    let branch: PublicBranch | null = null;
    if (preselectBranchId) {
      branch = branches.find((b) => b.id === preselectBranchId) ?? null;
    }
    if (!branch && emp?.branchIds && emp.branchIds.length === 1) {
      branch = branches.find((b) => b.id === emp.branchIds![0]) ?? null;
    }
    if (!branch && branches.length === 1) {
      branch = branches[0];
    }
    if (branch) {
      dispatchUi({ type: 'PICK_BRANCH', branch });
    }

    if (svc) dispatch({ type: 'SELECT_SERVICE', service: svc });

    if (emp) {
      if (svc) {
        dispatch({ type: 'SELECT_EMPLOYEE', employee: emp });
      } else {
        // Therapist-only deep link → lock until a service is picked.
        dispatchUi({ type: 'LOCK_EMPLOYEE', employee: emp });
      }
    }

    didPreselectRef.current = true;
    setPreselectDone(true);
  }, [
    loadingData,
    employees,
    services,
    branches,
    preselectEmployeeId,
    preselectServiceId,
    preselectBranchId,
  ]);

  // Branch-first: when the user lands on the wizard with multiple branches and
  // hasn't picked one yet, immediately show the branch picker as step 1.
  // Skipped until the preselect pass has run (otherwise a deep-link that would
  // auto-pick the branch flashes the branch picker first).
  useEffect(() => {
    if (loadingData) return;
    if (!preselectDone) return;
    if (!hasBranchStep) return;
    if (selectedBranch) return;
    if (awaitingBranch) return;
    if (state.step !== WizardStep.SERVICE) return;
    if (lockedEmployee) return;
    // Skip auto branch picker when entering via a category deep link — the user
    // came to browse services in that clinic, branch will be inferred from the
    // chosen therapist's branches later.
    if (preselectCategoryId) return;
    dispatchUi({ type: 'OPEN_INITIAL_BRANCH_PICK' });
  }, [
    loadingData,
    preselectDone,
    hasBranchStep,
    selectedBranch,
    awaitingBranch,
    state,
    lockedEmployee,
    preselectCategoryId,
  ]);

  const service =
    state.step === WizardStep.THERAPIST ||
    state.step === WizardStep.SLOT ||
    state.step === WizardStep.INFO_OTP ||
    state.step === WizardStep.PAYMENT
      ? state.service
      : null;
  const employee =
    state.step === WizardStep.SLOT ||
    state.step === WizardStep.INFO_OTP ||
    state.step === WizardStep.PAYMENT
      ? state.employee
      : null;
  const slot =
    state.step === WizardStep.INFO_OTP || state.step === WizardStep.PAYMENT
      ? state.slot
      : null;

  const effectiveBranch = selectedBranch ?? (!hasBranchStep ? branches[0] ?? null : null);
  const effectiveBranchId = effectiveBranch?.id;

  // The visible flow (stepper) for the current entry point.
  const flow = useMemo(
    () => buildFlow(entryPoint, hasBranchStep),
    [entryPoint, hasBranchStep],
  );
  const labelOf: Record<WizardScreen, string> = {
    service: t('booking.step.service'),
    therapist: t('booking.step.therapist'),
    branch: t('booking.step.branch'),
    slot: t('booking.step.slot'),
    info: t('booking.step.info'),
  };
  const stepLabels = flow.map((s) => labelOf[s]);

  // Which visible screen are we on right now?
  const currentScreen: WizardScreen = useMemo(() => {
    if (awaitingBranch) return 'branch';
    switch (state.step) {
      case WizardStep.SERVICE:
        return 'service';
      case WizardStep.THERAPIST:
        return 'therapist';
      case WizardStep.SLOT:
        return 'slot';
      case WizardStep.INFO_OTP:
      case WizardStep.PAYMENT:
        return 'info';
      default:
        return 'info';
    }
  }, [state.step, awaitingBranch]);

  const stepIndex = Math.max(0, flow.indexOf(currentScreen));

  const employeeId = employee?.id;
  const serviceId = service?.id;
  const branchId = effectiveBranchId;
  const { data: slots = [], isLoading: loadingSlots } = useQuery({
    queryKey: [
      'public',
      'availability',
      employeeId,
      selectedDate,
      serviceId,
      branchId,
      selectedChoice?.durationOptionId,
      selectedChoice?.deliveryType,
    ],
    queryFn: () =>
      getPublicAvailability(employeeId!, selectedDate, serviceId, branchId, {
        durationOptionId: selectedChoice?.durationOptionId,
        deliveryType: selectedChoice?.deliveryType,
      }),
    enabled: state.step === WizardStep.SLOT && !!employeeId && !!branchId,
  });

  // Per-day "has any slot?" probe drives the date-strip greying. Anchored to
  // today and renewed when employee/service/branch change.
  const { data: availabilityDays = [] } = useQuery({
    queryKey: [
      'public',
      'availability',
      'days',
      employeeId,
      serviceId,
      branchId,
      selectedChoice?.durationOptionId,
      selectedChoice?.deliveryType,
    ],
    queryFn: () =>
      getPublicAvailabilityDays(employeeId!, {
        serviceId,
        branchId,
        days: 14,
      }),
    enabled: state.step === WizardStep.SLOT && !!employeeId && !!branchId,
  });
  const bookableDates = useMemo(
    () => new Set(availabilityDays.filter((d) => d.hasSlots).map((d) => d.date)),
    [availabilityDays],
  );

  // === Handlers (entry-point aware) ===

  const handleServiceSelect = (
    svc: Service,
    choice?: { durationOptionId: string; deliveryType: 'IN_PERSON' | 'ONLINE' },
  ) => {
    dispatch({ type: 'SELECT_SERVICE', service: svc });
    dispatchUi({ type: 'SET_CHOICE', choice: choice ?? null });
    // If a therapist was already chosen (deep link), apply it now — the state
    // machine accepts SELECT_EMPLOYEE only after SELECT_SERVICE, so we sequence
    // them.
    const carriedTherapist = lockedEmployee;
    if (carriedTherapist) {
      dispatch({ type: 'SELECT_EMPLOYEE', employee: carriedTherapist });
      dispatchUi({ type: 'CLEAR_LOCKED_EMPLOYEE' });
    }
  };

  const handleTherapistSelect = (emp: EmployeeWithUser) => {
    if (entryPoint === 'therapist') {
      // Therapist-first deep link: lock the therapist; service step comes next.
      dispatchUi({ type: 'LOCK_EMPLOYEE', employee: emp });
      return;
    }
    // If we still don't have a branch (category deep link that skipped branch
    // step), infer it from the therapist: their only branch, or open picker if
    // they work at multiple.
    if (!selectedBranch && emp.branchIds && emp.branchIds.length >= 1) {
      if (emp.branchIds.length === 1) {
        const onlyBranch = branches.find((b) => b.id === emp.branchIds![0]);
        if (onlyBranch) dispatchUi({ type: 'PICK_BRANCH', branch: onlyBranch });
      } else {
        dispatchUi({ type: 'START_BRANCH_PICK', employee: emp });
        return;
      }
    }
    dispatch({ type: 'SELECT_EMPLOYEE', employee: emp });
  };

  const handleBranchSelect = (branch: PublicBranch) => {
    dispatchUi({ type: 'PICK_BRANCH', branch });
    // If a service is already set, finalize SELECT_EMPLOYEE now so the state
    // machine advances. If not (therapist-first, no service yet), the chosen
    // therapist stays in `lockedEmployee` and we land back on the service
    // screen.
    if (service && pendingEmployee) {
      dispatch({ type: 'SELECT_EMPLOYEE', employee: pendingEmployee });
      dispatchUi({ type: 'CLEAR_LOCKED_EMPLOYEE' });
    }
  };

  const handleBranchCancel = () => {
    dispatchUi({ type: 'CANCEL_BRANCH_PICK' });
    if (entryPoint === 'therapist' && lockedEmployee) {
      // From the branch screen in therapist-first mode, "back" returns to the
      // therapist list. Clearing the lock lets the user pick a different one.
      dispatchUi({ type: 'CLEAR_LOCKED_EMPLOYEE' });
    }
  };

  // Cross-selection narrowing — backend now ships serviceIds + branchIds + isBookable
  // on each public employee, so we use them to keep both sides of the funnel honest.
  const bookableEmployees = useMemo(
    () => employees.filter((e) => e.isBookable !== false),
    [employees],
  );

  // Once a branch is chosen (branch-first flow), restrict the pool of employees
  // to those who actually work at that branch. Services and therapist lists are
  // derived from this restricted pool.
  const branchScopedEmployees = useMemo(() => {
    if (!selectedBranch) return bookableEmployees;
    return bookableEmployees.filter((e) =>
      (e.branchIds ?? []).includes(selectedBranch.id),
    );
  }, [bookableEmployees, selectedBranch]);

  // Set of service ids that at least one bookable therapist actually delivers,
  // scoped to the chosen branch when applicable.
  const bookableServiceIds = useMemo(() => {
    const set = new Set<string>();
    for (const e of branchScopedEmployees) {
      for (const sid of e.serviceIds ?? []) set.add(sid);
    }
    return set;
  }, [branchScopedEmployees]);

  const filteredServices = useMemo(() => {
    const base = services.filter((s) => bookableServiceIds.has(s.id));
    if (lockedEmployee?.serviceIds && lockedEmployee.serviceIds.length > 0) {
      const allowed = new Set(lockedEmployee.serviceIds);
      return base.filter((s) => allowed.has(s.id));
    }
    return base;
  }, [services, bookableServiceIds, lockedEmployee]);

  const filteredTherapists = useMemo(() => {
    if (!service) return branchScopedEmployees;
    return branchScopedEmployees.filter((e) => (e.serviceIds ?? []).includes(service.id));
  }, [branchScopedEmployees, service]);

  // Auto-skip therapist step if the chosen service has exactly one offering
  // therapist — there's no choice to make. Applies only to service-first flow.
  useEffect(() => {
    if (entryPoint !== 'service') return;
    if (state.step !== WizardStep.THERAPIST) return;
    if (loadingData) return;
    if (filteredTherapists.length !== 1) return;
    const only = filteredTherapists[0];
    if (hasBranchStep) {
      dispatchUi({ type: 'START_BRANCH_PICK', employee: only });
    } else {
      dispatch({ type: 'SELECT_EMPLOYEE', employee: only });
    }
  }, [entryPoint, state.step, loadingData, filteredTherapists, hasBranchStep]);

  // Snap selectedDate forward to the first day that actually has open slots.
  // Uses the per-day probe; falls back to the employee's weekday rules until
  // the probe lands. Prevents the user starting on a guaranteed-dead day.
  useEffect(() => {
    if (state.step !== WizardStep.SLOT) return;
    if (!employee) return;
    if (availabilityDays.length === 0) return;
    if (bookableDates.has(selectedDate)) return;
    const first = availabilityDays.find((d) => d.hasSlots);
    if (first) dispatchUi({ type: 'SET_DATE', date: first.date });
  }, [state.step, employee, selectedDate, availabilityDays, bookableDates]);

  // Hard gate: if loading finished and there's literally nothing bookable
  // *anywhere* (any branch), show a contact-us screen. Don't trigger this just
  // because the user's currently-selected branch happens to have no offerings —
  // that case is handled with an in-flow message.
  const globalBookableServiceIds = useMemo(() => {
    const set = new Set<string>();
    for (const e of bookableEmployees) for (const sid of e.serviceIds ?? []) set.add(sid);
    return set;
  }, [bookableEmployees]);
  const nothingBookable =
    !loadingData &&
    (bookableEmployees.length === 0 ||
      globalBookableServiceIds.size === 0 ||
      branches.length === 0);

  if (redirectUrl && bookingId) {
    return <PaymentRedirect redirectUrl={redirectUrl} bookingId={bookingId} />;
  }

  const lockedTherapistName = lockedEmployee?.user
    ? `${lockedEmployee.user.firstName ?? ''} ${lockedEmployee.user.lastName ?? ''}`.trim() || null
    : null;

  const handleClose = () => {
    // Always exit booking to a known destination. Using router.back() is unreliable
    // when the referrer was the booking flow itself (deep links, internal navigation).
    const referrer = typeof document !== 'undefined' ? document.referrer : '';
    const sameOrigin =
      referrer &&
      typeof window !== 'undefined' &&
      referrer.startsWith(window.location.origin) &&
      !referrer.includes('/booking');
    if (sameOrigin) {
      router.back();
    } else {
      router.push('/');
    }
  };

  /**
   * Step-back: go to the previous wizard screen. Mirrors the flow order.
   * On the very first screen it exits the booking flow (same as the close button).
   */
  const handleStepBack = () => {
    if (awaitingBranch) {
      // Branch is the first step. Pressing back from here always exits the
      // booking flow (the branch picker is step 1, there's nothing behind it).
      handleClose();
      return;
    }
    switch (state.step) {
      case WizardStep.SERVICE:
        // First content step after branch. Re-open branch picker (multi) or
        // exit the booking flow entirely (single-branch).
        if (hasBranchStep) {
          dispatchUi({ type: 'OPEN_INITIAL_BRANCH_PICK' });
        } else {
          handleClose();
        }
        break;
      case WizardStep.THERAPIST:
        // Back to service picker.
        dispatch({ type: 'RESET' });
        dispatchUi({ type: 'SET_CHOICE', choice: null });
        break;
      case WizardStep.SLOT:
        // Back to therapist picker.
        if (state.service) {
          dispatch({ type: 'SELECT_SERVICE', service: state.service });
        }
        break;
      case WizardStep.INFO_OTP:
      case WizardStep.PAYMENT:
        // Back from info/payment → return to the slot picker.
        if (state.employee) {
          dispatch({ type: 'SELECT_EMPLOYEE', employee: state.employee });
        } else if (employee) {
          dispatch({ type: 'SELECT_EMPLOYEE', employee });
        }
        break;
      default:
        break;
    }
  };

  // Back button is always available: on inner steps it goes to the previous
  // wizard screen; on the first step it exits the booking flow entirely.
  const canStepBack = true;

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 sm:px-6 pt-6 sm:pt-8 pb-16">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div className="flex items-center gap-2">
          <IconButton onClick={handleClose} ariaLabel="إغلاق">
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </IconButton>
          {canStepBack && (
            <IconButton onClick={handleStepBack} ariaLabel={t('booking.back')}>
              {/* Arrow points to the START of the inline axis (right in RTL, left in LTR) */}
              <svg viewBox="0 0 16 16" className="h-4 w-4 rtl:scale-x-[-1]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 4l-4 4 4 4" />
                <path d="M6 8h8" />
              </svg>
            </IconButton>
          )}
        </div>
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--sw-secondary-500)', letterSpacing: '0.06em' }}
        >
          {t('booking.summary.title')}
        </span>
      </div>

      <ProgressBar current={stepIndex} labels={stepLabels} />

      {(loadError || submitError) && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm"
          style={{
            background: 'color-mix(in srgb, var(--destructive) 8%, var(--sw-cream))',
            color: 'color-mix(in srgb, var(--destructive) 80%, var(--sw-secondary-900))',
            border: '1px solid color-mix(in srgb, var(--destructive) 20%, transparent)',
          }}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 5v3.5M8 10.5v.5" strokeLinecap="round" />
          </svg>
          <span>{loadError || submitError}</span>
        </div>
      )}

      {/* === GLOBAL DEAD-END: nothing to book === */}
      {nothingBookable && (
        <div
          className="flex flex-col items-center text-center gap-4 px-6 py-14 rounded-2xl"
          style={{
            background: 'color-mix(in srgb, var(--primary) 4%, var(--sw-cream))',
            border: '1px dashed color-mix(in srgb, var(--sw-secondary-700) 14%, transparent)',
          }}
        >
          <span
            aria-hidden="true"
            className="grid place-items-center h-14 w-14 rounded-full"
            style={{
              background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
              color: 'var(--primary)',
            }}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
              <path d="M3.5 9.5h17M8 3v4M16 3v4" />
            </svg>
          </span>
          <h2 className="text-lg font-bold" style={{ color: 'var(--sw-secondary-900)' }}>
            {t('booking.unavailable.title')}
          </h2>
          <p
            className="text-sm leading-relaxed max-w-[44ch]"
            style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 65%, transparent)' }}
          >
            {t('booking.unavailable.body')}
          </p>
          <a
            href="/contact"
            className="mt-2 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              boxShadow: 'var(--sw-shadow-primary)',
            }}
          >
            {t('booking.unavailable.cta')}
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 -scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 4l4 4-4 4" />
            </svg>
          </a>
        </div>
      )}

      {/* === BRANCH SCREEN (modal-ish, shown whenever awaitingBranch) === */}
      {!nothingBookable && awaitingBranch && (
        <BranchStep
          branches={(() => {
            const emp = pendingEmployee ?? lockedEmployee;
            const ids = emp?.branchIds;
            if (!ids || ids.length === 0) return branches;
            const filtered = branches.filter((b) => ids.includes(b.id));
            return filtered.length > 0 ? filtered : branches;
          })()}
          onSelect={handleBranchSelect}
          onBack={handleBranchCancel}
        />
      )}

      {/* === SERVICE SCREEN === */}
      {!nothingBookable && !awaitingBranch && state.step === WizardStep.SERVICE && (
        loadingData ? (
          <BookingSkeleton count={4} />
        ) : (
          <div className="flex flex-col gap-5">
            <ServicePicker
              services={filteredServices}
              categories={categories}
              selected={null}
              vatRate={vatRate}
              onSelect={handleServiceSelect}
              lockedTherapistName={entryPoint === 'therapist' ? lockedTherapistName : null}
              onClearLockedTherapist={
                entryPoint === 'therapist'
                  ? () => dispatchUi({ type: 'CLEAR_LOCKED_EMPLOYEE' })
                  : undefined
              }
              initialCategoryId={preselectCategoryId}
            />
          </div>
        )
      )}

      {/* === THERAPIST SCREEN === */}
      {!nothingBookable && !awaitingBranch && state.step === WizardStep.THERAPIST && (
        <div className="flex flex-col gap-5">
          {loadingData ? (
            <BookingSkeleton count={4} />
          ) : (
            <TherapistPicker
              therapists={filteredTherapists}
              selected={null}
              onSelect={handleTherapistSelect}
            />
          )}
        </div>
      )}

      {/* === SLOT SCREEN === */}
      {!nothingBookable && !awaitingBranch && state.step === WizardStep.SLOT && service && employee && (
        <div className="flex flex-col gap-5">
          <DateStrip
            value={selectedDate}
            onChange={(iso) => dispatchUi({ type: 'SET_DATE', date: iso })}
            allowedDaysOfWeek={employee.availableDaysOfWeek}
            bookableDates={bookableDates}
          />
          <SlotPicker
            slots={slots}
            selected={null}
            onSelect={(s) => dispatch({ type: 'SELECT_SLOT', slot: s })}
            isLoading={loadingSlots}
          />
        </div>
      )}

      {/* === INFO + PAYMENT (merged) === */}
      {state.step === WizardStep.INFO_OTP && service && employee && slot && (
        <ClientInfoStep
          slot={slot}
          service={service}
          employee={employee}
          vatRate={vatRate}
          onBack={() => dispatch({ type: 'SELECT_EMPLOYEE', employee })}
          onSubmitInfo={async () => {
            dispatchUi({ type: 'SUBMIT_START' });
            try {
              if (!effectiveBranchId) {
                dispatchUi({ type: 'SUBMIT_ERROR', error: t('booking.errors.missingBranch') });
                return;
              }
              const booking = await createBooking({
                serviceId: service.id,
                employeeId: employee.id,
                branchId: effectiveBranchId,
                startsAt: slot.startTime,
                durationOptionId: selectedChoice?.durationOptionId,
                deliveryType: selectedChoice?.deliveryType,
              });
              if (!booking.invoiceId) {
                dispatchUi({ type: 'SUBMIT_ERROR', error: t('common.bookingFailed') });
                return;
              }
              const payment = await initPayment(booking.invoiceId);
              dispatchUi({
                type: 'SUBMIT_DONE',
                bookingId: booking.id,
                redirectUrl: payment.redirectUrl,
              });
            } catch (err) {
              dispatchUi({
                type: 'SUBMIT_ERROR',
                error: err instanceof Error ? err.message : t('common.bookingFailed'),
              });
            }
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {/* === CONFIRMATION === */}
      {state.step === WizardStep.CONFIRMATION && (
        <div className="text-center py-12 px-4 flex flex-col items-center gap-5">
          {state.status === 'success' ? (
            <>
              <div
                className="inline-flex h-16 w-16 items-center justify-center rounded-full"
                style={{
                  background: 'color-mix(in srgb, var(--primary) 12%, var(--sw-cream))',
                  color: 'var(--primary)',
                }}
              >
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5 9.5-10" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--sw-secondary-900)' }}>
                {t('booking.confirmed')}
              </h2>
              <p className="text-sm max-w-[42ch]" style={{ color: 'var(--sw-secondary-500)' }}>
                {t('booking.confirmedDesc')}
              </p>
            </>
          ) : (
            <>
              <div
                className="inline-flex h-16 w-16 items-center justify-center rounded-full"
                style={{
                  background: 'color-mix(in srgb, var(--destructive) 10%, var(--sw-cream))',
                  color: 'var(--destructive)',
                }}
              >
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 7l10 10M17 7L7 17" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--sw-secondary-900)' }}>
                {t('booking.paymentFailed')}
              </h2>
              <p className="text-sm max-w-[42ch]" style={{ color: 'var(--sw-secondary-500)' }}>
                {t('booking.paymentFailedDesc')}
              </p>
            </>
          )}
          <button
            type="button"
            onClick={() => dispatch({ type: 'RESET' })}
            className="mt-2 inline-flex items-center justify-center px-7 py-3 rounded-full text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.99] cursor-pointer"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              boxShadow: 'var(--sw-shadow-primary)',
            }}
          >
            {state.status === 'success' ? t('booking.bookAnother') : t('booking.tryAgain')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function BookingWizardPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[640px] px-4 sm:px-6 pt-8 sm:pt-12 pb-16">
          <BookingSkeleton count={4} />
        </div>
      }
    >
      <BookingWizardInner />
    </Suspense>
  );
}
