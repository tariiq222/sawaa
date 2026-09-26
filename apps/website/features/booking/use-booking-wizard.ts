'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { reduce, INITIAL_WIZARD_STATE, WizardStep } from '@sawaa/shared';
import type { AvailableSlot, Service, EmployeeWithUser } from '@sawaa/shared';
import { publicFetch } from '@/lib/public-fetch';
import {
  getPublicAvailability,
  getPublicAvailabilityDays,
  getPublicBranches,
  createBooking,
  initPayment,
  getPractitionerBookingOptions,
  type PublicBranch,
} from '@/features/booking/booking.api';
import { resolveBookingSubmitOutcome } from '@/features/booking/booking-submit-outcome';
import { presentDirectClinicServices } from '@/features/booking/booking-catalog';
import { usePaymentMethods } from '@/features/payment/use-payment-methods';
import { useT, useLocale } from '@/features/locale/locale-provider';
import type { SummaryScreen } from '@/features/booking/summary-rail';
import {
  INITIAL_UI_STATE,
  uiReducer,
  buildFlow,
  type WizardScreen,
} from '@/features/booking/booking-wizard-state';

export function useBookingWizard() {
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
  // Bounded latch: remembers the (service.id, therapist.id) pair we already
  // auto-selected via the single-therapist shortcut so the effect does not
  // re-fire when the machine advances past THERAPIST and re-renders with the
  // same pair. Cleared whenever the user re-enters service selection so
  // returning to the same service after a back-out still auto-selects the
  // sole therapist and opens the dedicated choice step (not a parking
  // therapist screen).
  const autoSelectedPairRef = useRef<string | null>(null);
  // Monotonic request generation for the practitioner-options fetch. Every
  // load captures the current value and only writes back if it is still the
  // latest — older in-flight loads observe a mismatch on resolve or fail
  // and bail. This is the only mechanism that guarantees a stale slower
  // request cannot overwrite options for a newer pair after back/reselect.
  const practitionerOptionsRequestRef = useRef(0);
  // Mounted-ref guard so an in-flight load that resolves after the wizard
  // unmounts does not dispatch into an unmounted tree. The generation bump
  // in the cleanup effect above also covers this case, but the explicit
  // check is cheap and makes the intent obvious at every dispatch site.
  const mountedRef = useRef(true);
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
    paymentRecovery,
    practitionerOptions,
    practitionerOptionsLoading,
    showingChoiceStep,
    therapistStepDone,
  } = ui;

  const { data: employees = [], isLoading: loadingEmployees, error: employeesError } = useQuery({
    queryKey: ['public', 'employees'],
    queryFn: async () => {
      const json = await publicFetch<{ data?: EmployeeWithUser[] } | EmployeeWithUser[]>('/public/employees?includeDirectClinics=true');
      return Array.isArray(json) ? json : (json.data ?? []);
    },
  });

  const { data: catalog = { services: [], categories: [], vatRate: 0 }, isLoading: loadingServices, error: servicesError } = useQuery({
    queryKey: ['public', 'catalog'],
    queryFn: async () => {
      type Cat = { id: string; nameAr: string; nameEn: string; bookingMode?: 'DIRECT' | 'SERVICES' };
      type CatalogShape = { services: (Service & { isHidden?: boolean })[]; categories: Cat[]; vatRate?: number };
      const json = await publicFetch<{ data?: CatalogShape } | CatalogShape>('/public/services?includeDirectClinics=true');
      const payload = 'data' in json && json.data ? json.data : (json as CatalogShape);
      return {
        services: presentDirectClinicServices(payload.services ?? [], payload.categories ?? []),
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

  const { data: branches = [], isLoading: loadingBranches, error: branchesError } = useQuery({
    queryKey: ['public', 'branches'],
    queryFn: getPublicBranches,
  });

  // Deliberately NOT part of `loadingData`: a free booking needs no payment
  // method, so a failed lookup must only stop the paid path (the info step owns
  // that decision) instead of the whole wizard.
  const { data: paymentMethods, isLoading: paymentMethodsLoading } = usePaymentMethods();

  const loadingData = loadingEmployees || loadingServices || loadingBranches;
  const initialLoadError = employeesError ?? servicesError ?? branchesError;
  // Single-branch center: the branch step is never shown; the main branch is
  // auto-selected by the effects below and submitted transparently.
  const hasBranchStep = false;

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

  // Mount/unmount tracking for practitioner-options loads. On unmount we
  // bump the generation so any in-flight resolve/fail sees a stale id and
  // bails before dispatching UI updates into an unmounted tree.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      practitionerOptionsRequestRef.current += 1;
    };
  }, []);

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
    service: (service as (Service & { isHidden?: boolean }) | null)?.isHidden
      ? t('booking.step.clinic')
      : t('booking.step.service'),
    therapist: t('booking.step.therapist'),
    choice: t('booking.step.choice'),
    branch: t('booking.step.branch'),
    slot: t('booking.step.slot'),
    info: t('booking.step.info'),
  };
  const stepLabels = flow.map((s) => labelOf[s]);

  // Which visible screen are we on right now?
  const currentScreen: WizardScreen = useMemo(() => {
    if (awaitingBranch) return 'branch';
    // Only honour the choice flag while the machine has NOT yet advanced past
    // the choice point. When state.step is INFO_OTP/PAYMENT, a true
    // showingChoiceStep is stale (handleChoiceConfirm should have cleared it,
    // but a stale flag must never mask the later step).
    if (
      showingChoiceStep &&
      state.step !== WizardStep.INFO_OTP &&
      state.step !== WizardStep.PAYMENT
    ) {
      return 'choice';
    }
    // Therapist-first: the underlying machine starts at SERVICE, but the visible
    // first screen is the therapist picker (until the user confirms a therapist).
    if (entryPoint === 'therapist' && state.step === WizardStep.SERVICE && !therapistStepDone) return 'therapist';
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
  }, [state.step, awaitingBranch, showingChoiceStep, entryPoint, therapistStepDone]);

  // Belt-and-braces: if the machine reaches INFO_OTP/PAYMENT while the choice
  // flag is still true (e.g. user advanced directly to a slot radio without
  // confirming a choice option), clear it so state and view agree. Only fires
  // when the flag is actually true, so it does not loop.
  useEffect(() => {
    if (
      showingChoiceStep &&
      (state.step === WizardStep.INFO_OTP || state.step === WizardStep.PAYMENT)
    ) {
      dispatchUi({ type: 'EXIT_CHOICE_STEP' });
    }
  }, [state.step, showingChoiceStep]);

  const stepIndex = Math.max(0, flow.indexOf(currentScreen));

  const employeeId = employee?.id;
  const serviceId = service?.id;
  const branchId = effectiveBranchId;
  const { data: slots = [], isLoading: loadingSlots, error: slotsError } = useQuery({
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
  const { data: availabilityDays = [], error: availabilityDaysError } = useQuery({
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
        // Probe with the SAME duration/delivery context as the slot fetch so
        // the strip greys exactly the days the later query can book.
        durationOptionId: selectedChoice?.durationOptionId,
        deliveryType: selectedChoice?.deliveryType,
      }),
    enabled: state.step === WizardStep.SLOT && !!employeeId && !!branchId,
  });
  const bookableDates = useMemo(
    () => new Set(availabilityDays.filter((d) => d.hasSlots).map((d) => d.date)),
    [availabilityDays],
  );
  const loadError = initialLoadError ?? slotsError ?? availabilityDaysError;

  // === Handlers (entry-point aware) ===

  /**
   * Shared practitioner-options loader. Bumps the monotonic request
   * generation so any older in-flight load observes a stale id on resolve
   * or fail and bails before dispatching. Used by both the therapist-first
   * `handleServiceSelect` (carried therapist) and `selectTherapistAndLoadOptions`
   * so they take the same sequencing/invalidation contract.
   *
   * The loader owns the entire fetch + UI sequence: it clears any prior
   * options, marks loading=true, enters the choice step, awaits the fetch,
   * and only writes options / clears loading if its generation is still the
   * latest. Callers must clear `selectedChoice` before invoking this helper
   * so the summary reflects the new therapist context.
   */
  const loadPractitionerOptions = (svcId: string, empId: string) => {
    practitionerOptionsRequestRef.current += 1;
    const myRequestId = practitionerOptionsRequestRef.current;
    dispatchUi({ type: 'SET_PRACTITIONER_OPTIONS', opts: null });
    dispatchUi({ type: 'SET_PRACTITIONER_OPTIONS_LOADING', loading: true });
    dispatchUi({ type: 'ENTER_CHOICE_STEP' });
    void (async () => {
      try {
        const opts = await getPractitionerBookingOptions(svcId, empId);
        if (practitionerOptionsRequestRef.current !== myRequestId) return;
        if (!mountedRef.current) return;
        dispatchUi({ type: 'SET_PRACTITIONER_OPTIONS', opts });
      } catch {
        if (practitionerOptionsRequestRef.current !== myRequestId) return;
        if (!mountedRef.current) return;
        // Preserve existing failure behavior: the LATEST failed request
        // stores null options; stale failures are ignored.
        dispatchUi({ type: 'SET_PRACTITIONER_OPTIONS', opts: null });
      } finally {
        if (practitionerOptionsRequestRef.current !== myRequestId) return;
        if (!mountedRef.current) return;
        // Only the latest load may end the loading state — a stale load
        // must not silently clear a newer load's spinner.
        dispatchUi({ type: 'SET_PRACTITIONER_OPTIONS_LOADING', loading: false });
      }
    })();
  };

  /**
   * Invalidate any in-flight practitioner-options load WITHOUT starting a
   * replacement. Used by back / reset / unmount paths that need a late
   * response to never repopulate options on an earlier screen.
   */
  const invalidatePractitionerOptionsLoad = () => {
    practitionerOptionsRequestRef.current += 1;
  };

  /**
   * Select a service. Duration/attendance/price are decided later on the
   * dedicated choice screen — this handler never pre-commits a service-level
   * choice and always clears any stale `selectedChoice` from a prior flow.
   *
   * - service-first flow: the underlying state machine advances to THERAPIST.
   * - therapist-first flow: the carried therapist from the deep-link is
   *   pushed into the machine, the dedicated choice screen is shown while
   *   practitioner options load.
   */
  const handleServiceSelect = async (svc: Service) => {
    dispatch({ type: 'SELECT_SERVICE', service: svc });
    dispatchUi({ type: 'CLEAR_PAYMENT_RECOVERY' });
    // Always clear stale choices: the dedicated choice screen is the only
    // place the user commits { durationOptionId, deliveryType }.
    dispatchUi({ type: 'SET_CHOICE', choice: null });
    // Clear the single-therapist latch so re-selecting this service (or any
    // service) on a fresh entry lets the auto-skip re-fire if applicable —
    // otherwise returning to service then choosing the same service parks
    // the user on the therapist step with no way to advance.
    autoSelectedPairRef.current = null;
    const carriedTherapist = lockedEmployee;
    if (carriedTherapist) {
      dispatch({ type: 'SELECT_EMPLOYEE', employee: carriedTherapist });
      dispatchUi({ type: 'CLEAR_LOCKED_EMPLOYEE' });
      loadPractitionerOptions(svc.id, carriedTherapist.id);
    }
  };

  /**
   * Shared helper: select a therapist and enter the dedicated choice screen
   * while practitioner options load. Used both by manual therapist selection
   * and the single-therapist auto-skip effect so both paths take exactly one
   * fetch and converge on the same screen.
   */
  const selectTherapistAndLoadOptions = async (emp: EmployeeWithUser) => {
    dispatch({ type: 'SELECT_EMPLOYEE', employee: emp });
    if (!service) return;
    // Clear the prior therapist's choice before entering the dedicated
    // choice screen for the new therapist — otherwise the summary keeps
    // showing the prior therapist's duration/delivery/total until a new
    // option is committed (committed-only summary must reflect the active
    // therapist context, not the previous one).
    dispatchUi({ type: 'SET_CHOICE', choice: null });
    loadPractitionerOptions(service.id, emp.id);
  };

  const handleTherapistSelect = async (emp: EmployeeWithUser) => {
    if (entryPoint === 'therapist') {
      dispatchUi({ type: 'LOCK_EMPLOYEE', employee: emp });
      dispatchUi({ type: 'THERAPIST_STEP_DONE' });
      return;
    }
    await selectTherapistAndLoadOptions(emp);
  };

  const handleChoiceConfirm = (choice: { durationOptionId: string; deliveryType: 'IN_PERSON' | 'ONLINE' }) => {
    dispatchUi({ type: 'SET_CHOICE', choice });
    dispatchUi({ type: 'EXIT_CHOICE_STEP' });
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
    const base = services.filter((s) => !s.isHidden && bookableServiceIds.has(s.id));
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
  // therapist — there's no real therapist choice to make. The dedicated
  // choice screen is still shown so the user explicitly commits
  // duration/attendance/price, and practitioner options are loaded exactly
  // once for that single therapist.
  //
  // Applies only to service-first flow. Branch is always pre-selected in the
  // new model, so we never open a branch picker.
  useEffect(() => {
    if (entryPoint !== 'service') return;
    if (state.step !== WizardStep.THERAPIST) return;
    if (loadingData) return;
    if (filteredTherapists.length !== 1) return;
    const only = filteredTherapists[0];
    const pairKey = `${service?.id ?? ''}::${only.id}`;
    if (autoSelectedPairRef.current === pairKey) return;
    autoSelectedPairRef.current = pairKey;
    void selectTherapistAndLoadOptions(only);
    // selectTherapistAndLoadOptions is intentionally NOT in the deps: it is
    // recreated on every render and depends on closures already captured
    // here. The pair-key ref + filteredTherapists guard re-runs prevent
    // infinite loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryPoint, state.step, loadingData, filteredTherapists, service]);

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
    !loadError &&
    !loadingData &&
    (bookableEmployees.length === 0 ||
      globalBookableServiceIds.size === 0 ||
      branches.length === 0);

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
    // The confirmation screen is terminal (like the shared machine's
    // CONFIRMATION step) — the only exits are "book another" (RESET) or close.
    if (ui.confirmed || paymentRecovery) return;
    if (awaitingBranch) {
      // Branch picker was opened via the change-branch affordance or summary
      // rail edit. Pressing back cancels the change and returns to the current
      // step — the branch that was selected before stays unchanged.
      dispatchUi({ type: 'CANCEL_BRANCH_PICK' });
      return;
    }
    if (showingChoiceStep) {
      dispatchUi({ type: 'EXIT_CHOICE_STEP' });
      // Invalidate any in-flight load so a late response cannot repopulate
      // options on the therapist screen we are returning to — even if no
      // replacement request is starting.
      invalidatePractitionerOptionsLoad();
      dispatchUi({ type: 'SET_PRACTITIONER_OPTIONS', opts: null });
      // Clear the single-therapist latch so going back from the choice step
      // with exactly one therapist re-fires the auto-skip and routes the user
      // back through the dedicated choice screen (not a parking therapist
      // step from which they cannot advance).
      autoSelectedPairRef.current = null;
      if (service) {
        dispatch({ type: 'SELECT_SERVICE', service });
      }
      return;
    }
    // Therapist-first: back from service → return to therapist screen
    if (entryPoint === 'therapist' && therapistStepDone && state.step === WizardStep.SERVICE) {
      dispatchUi({ type: 'THERAPIST_STEP_UNDONE' });
      dispatchUi({ type: 'SET_CHOICE', choice: null });
      return;
    }
    switch (state.step) {
      case WizardStep.SERVICE:
        // First content step. Branch is auto-selected — pressing back exits
        // the booking flow. The user can change the branch via the affordance.
        handleClose();
        break;
      case WizardStep.THERAPIST:
        if ((service as (Service & { isHidden?: boolean }) | null)?.isHidden) {
          handleClose();
          break;
        }
        // Back to service picker.
        dispatch({ type: 'RESET' });
        dispatchUi({ type: 'SET_CHOICE', choice: null });
        // No in-flight load expected here (choice was never entered), but
        // invalidate for symmetry — keeps the contract uniform across paths
        // that drop the therapist context.
        invalidatePractitionerOptionsLoad();
        break;
      case WizardStep.SLOT:
        // Back to therapist picker — the underlying machine drops back to
        // THERAPIST. For services with exactly one therapist, the auto-skip
        // below will re-fire and route the user through the dedicated
        // choice step so they can revise duration/delivery/total — they do
        // NOT return directly to the slot screen. The latch must be reset;
        // otherwise the auto-skip would see the same (service, therapist)
        // pair and park the user on the therapist step with no way to
        // advance.
        if (state.service) {
          dispatch({ type: 'SELECT_SERVICE', service: state.service });
        }
        autoSelectedPairRef.current = null;
        // Symmetric invalidation: if the user backed out of choice before
        // the first load resolved, this guarantees the in-flight resolve
        // cannot write options to the therapist picker we are returning to.
        invalidatePractitionerOptionsLoad();
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

  // Once a booking exists, freeze its selections and require the explicit
  // "book another" action before reopening the wizard for a new booking.
  const canStepBack = paymentRecovery === null;

  /**
   * Jump back to a completed step from the live summary. Reuses the exact
   * transitions the step-back handler performs, so the state machine stays
   * consistent. Changing the branch restarts the funnel (services and
   * therapists vary per branch).
   */
  const jumpToScreen = (screen: SummaryScreen) => {
    if (isSubmitting || paymentRecovery) return;
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
        dispatchUi({ type: 'EXIT_CHOICE_STEP' });
        // Invalidate any in-flight load so a late response cannot repopulate
        // options on the therapist screen we are returning to.
        invalidatePractitionerOptionsLoad();
        dispatchUi({ type: 'SET_PRACTITIONER_OPTIONS', opts: null });
        // Allow the single-therapist auto-skip to re-evaluate with fresh
        // therapist data when the user re-enters the therapist screen.
        autoSelectedPairRef.current = null;
        break;
      case 'slot':
        if (employee) dispatch({ type: 'SELECT_EMPLOYEE', employee });
        break;
      default:
        break;
    }
  };

  const isConfirmation = state.step === WizardStep.CONFIRMATION || ui.confirmed;
  // Success on the confirmation screen: either the shared machine reached a
  // successful CONFIRMATION, or the booking completed locally without an
  // online payment (CONFIRMED / DEPOSIT_PAID with no invoice).
  const confirmationSucceeded =
    ui.confirmed || (state.step === WizardStep.CONFIRMATION && state.status === 'success');
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
    activeScreen: awaitingBranch
      ? ('branch' as const)
      : currentScreen === 'info'
        ? null
        : (currentScreen as SummaryScreen),
    vatRate,
    onEdit: jumpToScreen,
    resolvedPriceHalalas: (() => {
      if (!selectedChoice || !practitionerOptions) return null;
      const opt = practitionerOptions.options.find(
        (o) => o.durationOptionId === selectedChoice.durationOptionId && o.deliveryType === selectedChoice.deliveryType,
      );
      return opt?.price ?? null;
    })(),
  };

  const selectedPriceHalalas = (() => {
    if (!selectedChoice) return undefined;
    if (practitionerOptions) {
      const opt = practitionerOptions.options.find(
        (o) => o.durationOptionId === selectedChoice.durationOptionId && o.deliveryType === selectedChoice.deliveryType,
      );
      if (opt != null) return opt.price;
    }
    const ext = service as (Service & {
      durationOptions?: Array<{ id: string; price: number | string }>;
      bookingConfigs?: Array<{ id: string; price: number | string }>;
    }) | null;
    if (!ext || !selectedChoice) return undefined;
    const svcOpt =
      ext.durationOptions?.find((o) => o.id === selectedChoice.durationOptionId) ??
      ext.bookingConfigs?.find((c) => c.id === selectedChoice.durationOptionId);
    return svcOpt != null ? Number(svcOpt.price) : undefined;
  })();

  const branchStepBranches = (() => {
    const emp = pendingEmployee ?? lockedEmployee;
    const ids = emp?.branchIds;
    if (!ids || ids.length === 0) return branches;
    const filtered = branches.filter((b) => ids.includes(b.id));
    return filtered.length > 0 ? filtered : branches;
  })();

  const handleSubmitInfo = async (payAtClinic: boolean) => {
    dispatchUi({ type: 'SUBMIT_START' });
    try {
      if (!effectiveBranchId) {
        dispatchUi({ type: 'SUBMIT_ERROR', error: t('booking.errors.missingBranch') });
        return;
      }
      if (!service || !employee || !slot) {
        dispatchUi({ type: 'SUBMIT_ERROR', error: t('common.bookingFailed') });
        return;
      }
      const recovered = paymentRecovery;
      const booking = recovered
        ? {
            id: recovered.bookingId,
            status: 'AWAITING_PAYMENT',
            invoiceId: recovered.invoiceId,
          }
        : await createBooking({
            serviceId: service.id,
            employeeId: employee.id,
            branchId: effectiveBranchId,
            startsAt: slot.startTime,
            durationOptionId: selectedChoice?.durationOptionId,
            deliveryType: selectedChoice?.deliveryType,
            payAtClinic,
          });
      const outcome = resolveBookingSubmitOutcome(booking);
      if (outcome.kind === 'failure') {
        dispatchUi({ type: 'SUBMIT_ERROR', error: t('common.bookingFailed') });
        return;
      }
      if (outcome.kind === 'payment') {
        dispatchUi({
          type: 'SET_PAYMENT_RECOVERY',
          bookingId: booking.id,
          invoiceId: outcome.invoiceId,
        });
        const payment = await initPayment(outcome.invoiceId);
        dispatchUi({
          type: 'SUBMIT_DONE',
          bookingId: booking.id,
          redirectUrl: payment.redirectUrl,
        });
        return;
      }
      dispatchUi({ type: 'SUBMIT_CONFIRMED', bookingId: booking.id });
    } catch (err) {
      dispatchUi({
        type: 'SUBMIT_ERROR',
        error: err instanceof Error ? err.message : t('common.bookingFailed'),
      });
    }
  };

  const handleBookAnother = () => {
    dispatch({ type: 'RESET' });
    dispatchUi({ type: 'CLEAR_COMPLETION' });
  };

  const handleStartOverFromRecovery = () => {
    dispatch({ type: 'RESET' });
    dispatchUi({ type: 'CLEAR_PAYMENT_RECOVERY' });
  };

  const handleSetDate = (iso: string) => dispatchUi({ type: 'SET_DATE', date: iso });
  const handleSelectSlot = (s: AvailableSlot) => dispatch({ type: 'SELECT_SLOT', slot: s });
  const handleClearLockedEmployee = () => dispatchUi({ type: 'CLEAR_LOCKED_EMPLOYEE' });
  const handleBackFromInfo = () => {
    if (employee) dispatch({ type: 'SELECT_EMPLOYEE', employee });
  };

  return {
    t,
    isAr,
    readyToRedirect: Boolean(redirectUrl && bookingId),
    redirectUrl,
    bookingId,
    nothingBookable,
    isConfirmation,
    confirmationSucceeded,
    showSummary,
    screenKey,
    stepIndex,
    stepLabels,
    loadError,
    submitError,
    paymentRecovery,
    summaryProps,
    currentScreen,
    loadingData,
    paymentMethods,
    paymentMethodsLoading,
    filteredServices,
    categories,
    filteredTherapists,
    branchStepBranches,
    lockedTherapistName,
    entryPoint,
    preselectCategoryId,
    service,
    employee,
    slot,
    practitionerOptions,
    practitionerOptionsLoading,
    vatRate,
    selectedDate,
    slots,
    loadingSlots,
    bookableDates,
    selectedPriceHalalas,
    isSubmitting,
    canStepBack,
    handleClose,
    handleStepBack,
    handleServiceSelect,
    handleTherapistSelect,
    handleChoiceConfirm,
    handleBranchSelect,
    handleBranchCancel,
    handleSubmitInfo,
    handleBookAnother,
    handleStartOverFromRecovery,
    handleSetDate,
    handleSelectSlot,
    handleClearLockedEmployee,
    handleBackFromInfo,
    jumpToScreen,
  };
}
