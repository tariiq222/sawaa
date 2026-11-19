import { WizardStep } from '@sawaa/shared';
import type { AvailableSlot, EmployeeWithUser, Service, WizardState } from '@sawaa/shared';
import type { MessageKey } from '@/features/locale/dictionary';
import type { PractitionerBookingOptions, PublicBranch } from './booking.api';
import type { SummaryScreen } from './summary-rail';
import type { UiState, WizardScreen } from './booking-wizard-state';
import { selectAvailableBookingServices } from './booking-catalog';

/**
 * Pure derivations over the shared wizard machine and the local UI state.
 * No React, no effects, no network — every function here is a plain input →
 * output mapping, so the behaviour can be reasoned about (and tested) without
 * mounting the wizard.
 */

export type WizardSelection = {
  service: Service | null;
  employee: EmployeeWithUser | null;
  slot: AvailableSlot | null;
};

export function deriveWizardSelection(state: WizardState): WizardSelection {
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
  return { service, employee, slot };
}

export function resolveCurrentScreen(
  step: WizardStep,
  ui: Pick<UiState, 'awaitingBranch' | 'showingChoiceStep' | 'entryPoint' | 'therapistStepDone'>,
): WizardScreen {
  if (ui.awaitingBranch) return 'branch';
  // Only honour the choice flag while the machine has NOT yet advanced past
  // the choice point. When state.step is INFO_OTP/PAYMENT, a true
  // showingChoiceStep is stale (handleChoiceConfirm should have cleared it,
  // but a stale flag must never mask the later step).
  if (
    ui.showingChoiceStep &&
    step !== WizardStep.INFO_OTP &&
    step !== WizardStep.PAYMENT
  ) {
    return 'choice';
  }
  // Therapist-first: the underlying machine starts at SERVICE, but the visible
  // first screen is the therapist picker (until the user confirms a therapist).
  if (ui.entryPoint === 'therapist' && step === WizardStep.SERVICE && !ui.therapistStepDone) {
    return 'therapist';
  }
  switch (step) {
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
}

export type StepLabelTranslator = (key: MessageKey) => string;

/**
 * Stepper labels for one flow. Direct-clinic bookings present their internal
 * service by the clinic name, so the first step is labelled "clinic".
 */
export function deriveStepLabels(
  flow: WizardScreen[],
  t: StepLabelTranslator,
  serviceIsHidden: boolean,
): string[] {
  const labelOf: Record<WizardScreen, string> = {
    service: serviceIsHidden ? t('booking.step.clinic') : t('booking.step.service'),
    therapist: t('booking.step.therapist'),
    choice: t('booking.step.choice'),
    branch: t('booking.step.branch'),
    slot: t('booking.step.slot'),
    info: t('booking.step.info'),
  };
  return flow.map((s) => labelOf[s]);
}

export function deriveBookableEmployees(employees: EmployeeWithUser[]): EmployeeWithUser[] {
  return employees.filter((e) => e.isBookable !== false);
}

export function deriveBranchScopedEmployees(
  bookableEmployees: EmployeeWithUser[],
  selectedBranch: PublicBranch | null,
): EmployeeWithUser[] {
  if (!selectedBranch) return bookableEmployees;
  return bookableEmployees.filter((e) =>
    (e.branchIds ?? []).includes(selectedBranch.id),
  );
}

export function deriveBookableServiceIds(
  branchScopedEmployees: EmployeeWithUser[],
): Set<string> {
  const set = new Set<string>();
  for (const e of branchScopedEmployees) {
    for (const sid of e.serviceIds ?? []) set.add(sid);
  }
  return set;
}

type CatalogService = { id: string; nameAr: string };
type CatalogCategory = { id: string; nameAr: string; bookingMode?: 'DIRECT' | 'SERVICES' };

export function deriveFilteredServices<T extends CatalogService>(
  services: T[],
  categories: CatalogCategory[],
  bookableServiceIds: ReadonlySet<string>,
  lockedEmployee: EmployeeWithUser | null,
): T[] {
  return selectAvailableBookingServices(services, categories, bookableServiceIds, lockedEmployee?.serviceIds);
}

export function deriveFilteredTherapists(
  branchScopedEmployees: EmployeeWithUser[],
  service: Service | null,
): EmployeeWithUser[] {
  if (!service) return branchScopedEmployees;
  return branchScopedEmployees.filter((e) => (e.serviceIds ?? []).includes(service.id));
}

export function deriveGlobalBookableServiceIds(
  bookableEmployees: EmployeeWithUser[],
): Set<string> {
  const set = new Set<string>();
  for (const e of bookableEmployees) for (const sid of e.serviceIds ?? []) set.add(sid);
  return set;
}

export function deriveNothingBookable(input: {
  loadError: unknown;
  loadingData: boolean;
  bookableEmployees: EmployeeWithUser[];
  globalBookableServiceIds: ReadonlySet<string>;
  branches: PublicBranch[];
}): boolean {
  return (
    !input.loadError &&
    !input.loadingData &&
    (input.bookableEmployees.length === 0 ||
      input.globalBookableServiceIds.size === 0 ||
      input.branches.length === 0)
  );
}

export function deriveLockedTherapistName(lockedEmployee: EmployeeWithUser | null): string | null {
  return lockedEmployee?.user
    ? `${lockedEmployee.user.firstName ?? ''} ${lockedEmployee.user.lastName ?? ''}`.trim() || null
    : null;
}

export function deriveBranchStepBranches(
  pendingEmployee: EmployeeWithUser | null,
  lockedEmployee: EmployeeWithUser | null,
  branches: PublicBranch[],
): PublicBranch[] {
  const emp = pendingEmployee ?? lockedEmployee;
  const ids = emp?.branchIds;
  if (!ids || ids.length === 0) return branches;
  const filtered = branches.filter((b) => ids.includes(b.id));
  return filtered.length > 0 ? filtered : branches;
}

export function resolveSelectedPriceHalalas(
  selectedChoice: UiState['selectedChoice'],
  practitionerOptions: PractitionerBookingOptions | null,
  service: Service | null,
): number | undefined {
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
}

export function resolvePriceFromOptions(
  selectedChoice: UiState['selectedChoice'],
  practitionerOptions: PractitionerBookingOptions | null,
): number | null {
  if (!selectedChoice || !practitionerOptions) return null;
  const opt = practitionerOptions.options.find(
    (o) => o.durationOptionId === selectedChoice.durationOptionId && o.deliveryType === selectedChoice.deliveryType,
  );
  return opt?.price ?? null;
}

export type WizardSummaryProps = {
  branch: PublicBranch | null;
  showBranch: boolean;
  service: Service | null;
  choice: UiState['selectedChoice'];
  employee: EmployeeWithUser | null;
  slot: AvailableSlot | null;
  activeScreen: SummaryScreen | null;
  vatRate: number;
  onEdit: (screen: SummaryScreen) => void;
  resolvedPriceHalalas: number | null;
};

export function deriveSummaryProps(input: {
  effectiveBranch: PublicBranch | null;
  hasBranchStep: boolean;
  service: Service | null;
  selectedChoice: UiState['selectedChoice'];
  employee: EmployeeWithUser | null;
  slot: AvailableSlot | null;
  awaitingBranch: boolean;
  currentScreen: WizardScreen;
  vatRate: number;
  practitionerOptions: PractitionerBookingOptions | null;
  onEdit: (screen: SummaryScreen) => void;
}): WizardSummaryProps {
  return {
    branch: input.effectiveBranch,
    showBranch: input.hasBranchStep,
    service: input.service,
    choice: input.selectedChoice,
    employee: input.employee,
    slot: input.slot,
    activeScreen: input.awaitingBranch
      ? ('branch' as const)
      : input.currentScreen === 'info'
        ? null
        : (input.currentScreen as SummaryScreen),
    vatRate: input.vatRate,
    onEdit: input.onEdit,
    resolvedPriceHalalas: resolvePriceFromOptions(input.selectedChoice, input.practitionerOptions),
  };
}

export function deriveScreenKey(input: {
  nothingBookable: boolean;
  isConfirmation: boolean;
  currentScreen: WizardScreen;
}): string {
  return input.nothingBookable
    ? 'dead-end'
    : input.isConfirmation
      ? 'confirmation'
      : input.currentScreen;
}

export function isWizardConfirmationSucceeded(state: WizardState, confirmed: boolean): boolean {
  return confirmed || (state.step === WizardStep.CONFIRMATION && state.status === 'success');
}
