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
import { SummaryRail, SummaryChips, type SummaryScreen } from '@/features/booking/summary-rail';
import { useT, useLocale } from '@/features/locale/locale-provider';
import '@/themes/sawaa/theme.css';

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
 * Branch is never a numbered step — the main branch is auto-selected on load
 * and the user can change it via the affordance without it counting as a step.
 */
function buildFlow(entryPoint: EntryPoint): WizardScreen[] {
  if (entryPoint === 'therapist') {
    return ['therapist', 'service', 'slot', 'info'];
  }
  return ['service', 'therapist', 'slot', 'info'];
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
      className="grid place-items-center h-10 w-10 rounded-full cursor-pointer transition-all bg-white"
      style={{
        color: 'var(--sw-secondary-700)',
        border: '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 12%, transparent)',
        boxShadow: 'var(--sw-shadow-xs)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 60%, transparent)';
        e.currentTarget.style.color = 'var(--primary-dark)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--sw-secondary-700) 12%, transparent)';
        e.currentTarget.style.color = 'var(--sw-secondary-700)';
      }}
    >
      {children}
    </button>
  );
}

function ProgressBar({ current, labels }: { current: number; labels: string[] }) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const total = labels.length;
  const counter = isAr ? `${current + 1} من ${total}` : `${current + 1} of ${total}`;
  return (
    <nav aria-label="Booking progress" className="mb-8 flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="text-sm font-extrabold tracking-tight"
          style={{ color: 'var(--sw-secondary-700)' }}
        >
          {labels[current]}
        </span>
        <span
          className="text-xs font-semibold tabular-nums shrink-0"
          style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 50%, transparent)' }}
        >
          {counter}
        </span>
      </div>
      <ol
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {labels.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={`step-${i}`}
              aria-current={active ? 'step' : undefined}
              className="h-1 rounded-full transition-colors duration-300"
              style={{
                background: done
                  ? 'var(--primary)'
                  : active
                    ? 'color-mix(in srgb, var(--primary) 45%, transparent)'
                    : 'color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)',
              }}
            >
              <span className="sr-only">{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function BookingWizardInner() {
  const t = useT();
  const locale = useLocale();
  const isAr = locale === 'ar';
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
    // Always resolve to a branch so the wizard never starts without one.
    // Prefer the branch the API marks as main; fall back to position 0.
    if (!branch) {
      branch = branches.find((b) => b.isMain) ?? branches[0] ?? null;
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

  // Auto-select the main branch on the no-params entry path (URL had none of
  // ?branchId, ?employeeId, ?serviceId, so the preselect effect exited early).
  // The main branch is the one the API marks as isMain; we fall back to the
  // first branch in the list if none is flagged. This runs once, after data
  // loads and the preselect pass completes.
  useEffect(() => {
    if (loadingData) return;
    if (!preselectDone) return;
    if (selectedBranch) return;      // already resolved (deep-link or prior run)
    if (branches.length === 0) return;
    const main = branches.find((b) => b.isMain) ?? branches[0];
    dispatchUi({ type: 'PICK_BRANCH', branch: main });
  }, [loadingData, preselectDone, selectedBranch, branches]);

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

  // selectedBranch is always set by the auto-select effects above; the fallback
  // covers the brief window before data loads.
  const effectiveBranch = selectedBranch ?? branches.find((b) => b.isMain) ?? branches[0] ?? null;
  const effectiveBranchId = effectiveBranch?.id;

  // The visible flow (stepper) for the current entry point.
  const flow = useMemo(
    () => buildFlow(entryPoint),
    [entryPoint],
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
  // Branch is always pre-selected in the new model, so we go straight to
  // SELECT_EMPLOYEE without opening a branch picker.
  useEffect(() => {
    if (entryPoint !== 'service') return;
    if (state.step !== WizardStep.THERAPIST) return;
    if (loadingData) return;
    if (filteredTherapists.length !== 1) return;
    const only = filteredTherapists[0];
    dispatch({ type: 'SELECT_EMPLOYEE', employee: only });
  }, [entryPoint, state.step, loadingData, filteredTherapists]);

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
    return (
      <div className="theme-sawaa">
        <PaymentRedirect redirectUrl={redirectUrl} bookingId={bookingId} />
      </div>
    );
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
      // Branch picker was opened via the change-branch affordance or summary
      // rail edit. Pressing back cancels the change and returns to the current
      // step — the branch that was selected before stays unchanged.
      dispatchUi({ type: 'CANCEL_BRANCH_PICK' });
      return;
    }
    switch (state.step) {
      case WizardStep.SERVICE:
        // First content step. Branch is auto-selected — pressing back exits
        // the booking flow. The user can change the branch via the affordance.
        handleClose();
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

  /**
   * Jump back to a completed step from the live summary. Reuses the exact
   * transitions the step-back handler performs, so the state machine stays
   * consistent. Changing the branch restarts the funnel (services and
   * therapists vary per branch).
   */
  const jumpToScreen = (screen: SummaryScreen) => {
    if (isSubmitting) return;
    switch (screen) {
      case 'branch':
        dispatch({ type: 'RESET' });
        dispatchUi({ type: 'SET_CHOICE', choice: null });
        dispatchUi({ type: 'OPEN_INITIAL_BRANCH_PICK' });
        break;
      case 'service':
        dispatch({ type: 'RESET' });
        dispatchUi({ type: 'SET_CHOICE', choice: null });
        break;
      case 'therapist':
        if (service) dispatch({ type: 'SELECT_SERVICE', service });
        break;
      case 'slot':
        if (employee) dispatch({ type: 'SELECT_EMPLOYEE', employee });
        break;
      default:
        break;
    }
  };

  const isConfirmation = state.step === WizardStep.CONFIRMATION;
  const screenKey = nothingBookable
    ? 'dead-end'
    : isConfirmation
      ? 'confirmation'
      : currentScreen;
  // The side summary lives next to the flow on desktop. The info step renders
  // its own receipt, so the rail bows out there to avoid saying things twice.
  const showSummary = !nothingBookable && !isConfirmation && currentScreen !== 'info';
  const summaryProps = {
    branch: effectiveBranch,
    showBranch: hasBranchStep,
    service,
    choice: selectedChoice,
    employee,
    slot,
    pendingDateIso: state.step === WizardStep.SLOT ? selectedDate : null,
    activeScreen: awaitingBranch
      ? ('branch' as const)
      : currentScreen === 'info'
        ? null
        : (currentScreen as SummaryScreen),
    vatRate,
    onEdit: jumpToScreen,
  };

  return (
    <div className="theme-sawaa">
      <div className="sw-section-mint min-h-screen">
        <div className="mx-auto w-full max-w-[1024px] px-4 sm:px-6 pt-6 sm:pt-8 pb-16">
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.6875rem] font-bold bg-white"
              style={{
                color: 'color-mix(in srgb, var(--sw-secondary-700) 65%, transparent)',
                border: '1px solid color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)',
                boxShadow: 'var(--sw-shadow-xs)',
              }}
            >
              <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="var(--primary-dark)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2.5" y="6" width="9" height="6" rx="1.5" />
                <path d="M4.5 6V4.5a2.5 2.5 0 1 1 5 0V6" />
              </svg>
              {isAr ? 'حجز آمن وسرّي' : 'Private & secure'}
            </span>
          </div>

          <div
            className={
              showSummary
                ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10 lg:items-start'
                : ''
            }
          >
            <div
              className={
                showSummary
                  ? 'mx-auto w-full max-w-[640px] lg:mx-0 lg:max-w-none'
                  : 'mx-auto w-full max-w-[640px]'
              }
            >
              {!nothingBookable && !isConfirmation && (
                <ProgressBar current={stepIndex} labels={stepLabels} />
              )}

              {/* Change-branch affordance — visible only when multiple branches exist
                  and the branch-picker step is not already open. */}
              {!nothingBookable && !isConfirmation && !awaitingBranch && branches.length > 1 && effectiveBranch && (
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span
                    className="text-xs font-medium truncate"
                    style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 55%, transparent)' }}
                  >
                    {isAr ? effectiveBranch.nameAr : (effectiveBranch.nameEn ?? effectiveBranch.nameAr)}
                  </span>
                  <button
                    type="button"
                    onClick={() => dispatchUi({ type: 'OPEN_INITIAL_BRANCH_PICK' })}
                    className="shrink-0 text-xs font-semibold underline underline-offset-2 cursor-pointer transition-opacity hover:opacity-70"
                    style={{ color: 'var(--primary-dark)' }}
                  >
                    {t('booking.changeBranch')}
                  </button>
                </div>
              )}

              {(loadError || submitError) && (
                <div
                  role="alert"
                  className="mb-6 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm bg-white"
                  style={{
                    color: 'var(--error)',
                    border: '1px solid color-mix(in srgb, var(--error) 25%, transparent)',
                    boxShadow: 'var(--sw-shadow-xs)',
                  }}
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="8" cy="8" r="6.5" />
                    <path d="M8 5v3.5M8 10.5v.5" strokeLinecap="round" />
                  </svg>
                  <span className="font-medium">{loadError || submitError}</span>
                </div>
              )}

              {showSummary && (
                <div className="mb-5">
                  <SummaryChips {...summaryProps} />
                </div>
              )}

              <div key={screenKey} className="sw-step-in">
                {/* === GLOBAL DEAD-END: nothing to book === */}
                {nothingBookable && (
                  <div
                    className="flex flex-col items-center text-center gap-4 px-6 py-14 rounded-[1.25rem] bg-white"
                    style={{
                      border: '1px dashed color-mix(in srgb, var(--sw-secondary-700) 18%, transparent)',
                      boxShadow: 'var(--sw-shadow-xs)',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="sw-pop-in grid place-items-center h-14 w-14 rounded-full"
                      style={{
                        background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                        color: 'var(--primary-dark)',
                      }}
                    >
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
                        <path d="M3.5 9.5h17M8 3v4M16 3v4" />
                      </svg>
                    </span>
                    <h2 className="text-lg font-extrabold" style={{ color: 'var(--sw-secondary-700)' }}>
                      {t('booking.unavailable.title')}
                    </h2>
                    <p
                      className="text-sm leading-relaxed max-w-[44ch]"
                      style={{ color: 'var(--sw-body)' }}
                    >
                      {t('booking.unavailable.body')}
                    </p>
                    <a
                      href="/contact"
                      className="mt-2 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.99]"
                      style={{
                        background: 'var(--primary)',
                        color: '#FFFFFF',
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

                {/* === BRANCH SCREEN (shown whenever awaitingBranch) === */}
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
                  <div className="flex flex-col gap-6">
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
                {isConfirmation && (
                  <div className="text-center py-12 px-4 flex flex-col items-center gap-5">
                    {state.step === WizardStep.CONFIRMATION && state.status === 'success' ? (
                      <>
                        <div
                          className="sw-pop-in inline-flex h-16 w-16 items-center justify-center rounded-full"
                          style={{
                            background: 'color-mix(in srgb, var(--primary) 14%, #FFFFFF)',
                            color: 'var(--primary-dark)',
                            boxShadow: '0 0 0 8px color-mix(in srgb, var(--primary) 6%, transparent)',
                          }}
                        >
                          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12.5l4.5 4.5 9.5-10" />
                          </svg>
                        </div>
                        <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--sw-secondary-700)' }}>
                          {t('booking.confirmed')}
                        </h2>
                        <p className="text-sm max-w-[42ch] leading-relaxed" style={{ color: 'var(--sw-body)' }}>
                          {t('booking.confirmedDesc')}
                        </p>
                      </>
                    ) : (
                      <>
                        <div
                          className="sw-pop-in inline-flex h-16 w-16 items-center justify-center rounded-full"
                          style={{
                            background: 'color-mix(in srgb, var(--error) 10%, #FFFFFF)',
                            color: 'var(--error)',
                            boxShadow: '0 0 0 8px color-mix(in srgb, var(--error) 5%, transparent)',
                          }}
                        >
                          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M7 7l10 10M17 7L7 17" />
                          </svg>
                        </div>
                        <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--sw-secondary-700)' }}>
                          {t('booking.paymentFailed')}
                        </h2>
                        <p className="text-sm max-w-[42ch] leading-relaxed" style={{ color: 'var(--sw-body)' }}>
                          {t('booking.paymentFailedDesc')}
                        </p>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'RESET' })}
                      className="mt-2 inline-flex items-center justify-center px-7 py-3 rounded-full text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.99] cursor-pointer"
                      style={{
                        background: 'var(--primary)',
                        color: '#FFFFFF',
                        boxShadow: 'var(--sw-shadow-primary)',
                      }}
                    >
                      {state.step === WizardStep.CONFIRMATION && state.status === 'success'
                        ? t('booking.bookAnother')
                        : t('booking.tryAgain')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {showSummary && (
              <div className="hidden lg:block">
                <SummaryRail {...summaryProps} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingWizardPage() {
  return (
    <Suspense
      fallback={
        <div className="theme-sawaa">
          <div className="sw-section-mint min-h-screen">
            <div className="mx-auto w-full max-w-[640px] px-4 sm:px-6 pt-8 sm:pt-12 pb-16">
              <BookingSkeleton count={4} />
            </div>
          </div>
        </div>
      }
    >
      <BookingWizardInner />
    </Suspense>
  );
}
