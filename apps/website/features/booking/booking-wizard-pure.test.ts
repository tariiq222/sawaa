import { describe, expect, it } from 'vitest';
import { INITIAL_WIZARD_STATE, WizardStep } from '@sawaa/shared';
import type { EmployeeWithUser, Service } from '@sawaa/shared';
import { INITIAL_UI_STATE, type UiState } from './booking-wizard-state';
import {
  deriveFilteredTherapists,
  deriveNothingBookable,
  deriveStepLabels,
  deriveWizardSelection,
  resolveCurrentScreen,
  resolveSelectedPriceHalalas,
} from './booking-wizard-derived';
import {
  planBranchCancel,
  planBranchSelect,
  planJumpToScreen,
  planStepBack,
} from './booking-wizard-transitions';

const service = {
  id: 'svc1',
  nameAr: 'خدمة',
  nameEn: 'Service',
  categoryId: 'cat1',
  price: 10000,
} as unknown as Service;

const employee = { id: 'emp1', serviceIds: ['svc1'] } as unknown as EmployeeWithUser;
const branch = { id: 'br1', nameAr: 'فرع', nameEn: 'Branch', isMain: true } as never;

function ui(overrides: Partial<UiState> = {}): UiState {
  return { ...INITIAL_UI_STATE, ...overrides };
}

describe('booking wizard pure derivations', () => {
  it('exposes selections only from the step that carries them', () => {
    expect(deriveWizardSelection(INITIAL_WIZARD_STATE)).toEqual({
      service: null,
      employee: null,
      slot: null,
    });
    expect(
      deriveWizardSelection({ step: WizardStep.THERAPIST, service }),
    ).toEqual({ service, employee: null, slot: null });
    expect(
      deriveWizardSelection({ step: WizardStep.SLOT, service, employee }),
    ).toEqual({ service, employee, slot: null });
  });

  it('resolves the visible screen for branch, choice and therapist-first entry', () => {
    expect(
      resolveCurrentScreen(WizardStep.SLOT, {
        awaitingBranch: true,
        showingChoiceStep: false,
        entryPoint: 'service',
        therapistStepDone: false,
      }),
    ).toBe('branch');

    expect(
      resolveCurrentScreen(WizardStep.THERAPIST, {
        awaitingBranch: false,
        showingChoiceStep: true,
        entryPoint: 'service',
        therapistStepDone: false,
      }),
    ).toBe('choice');

    // A stale choice flag must never mask INFO_OTP.
    expect(
      resolveCurrentScreen(WizardStep.INFO_OTP, {
        awaitingBranch: false,
        showingChoiceStep: true,
        entryPoint: 'service',
        therapistStepDone: false,
      }),
    ).toBe('info');

    expect(
      resolveCurrentScreen(WizardStep.SERVICE, {
        awaitingBranch: false,
        showingChoiceStep: false,
        entryPoint: 'therapist',
        therapistStepDone: false,
      }),
    ).toBe('therapist');
  });

  it('labels a hidden direct-clinic service as a clinic step', () => {
    const t = (key: string) => key;
    expect(deriveStepLabels(['service', 'therapist'], t, false)).toEqual([
      'booking.step.service',
      'booking.step.therapist',
    ]);
    expect(deriveStepLabels(['service', 'therapist'], t, true)).toEqual([
      'booking.step.clinic',
      'booking.step.therapist',
    ]);
  });

  it('filters therapists by the selected service and reports the dead-end gate', () => {
    const other = { id: 'emp2', serviceIds: ['svc2'] } as unknown as EmployeeWithUser;
    expect(deriveFilteredTherapists([employee, other], service)).toEqual([employee]);
    expect(
      deriveNothingBookable({
        loadError: null,
        loadingData: false,
        bookableEmployees: [],
        globalBookableServiceIds: new Set(),
        branches: [],
      }),
    ).toBe(true);
    expect(
      deriveNothingBookable({
        loadError: null,
        loadingData: false,
        bookableEmployees: [employee],
        globalBookableServiceIds: new Set(['svc1']),
        branches: [branch],
      }),
    ).toBe(false);
  });

  it('resolves the committed price from practitioner options before the service fallback', () => {
    expect(resolveSelectedPriceHalalas(null, null, service)).toBeUndefined();
    expect(
      resolveSelectedPriceHalalas(
        { durationOptionId: 'opt1', deliveryType: 'ONLINE' },
        {
          options: [
            { durationOptionId: 'opt1', deliveryType: 'ONLINE', price: 12000, durationMins: 60 },
          ],
        } as never,
        service,
      ),
    ).toBe(12000);
  });
});

describe('booking wizard transition plans', () => {
  it('closes the wizard from the first service screen', () => {
    expect(
      planStepBack({
        state: INITIAL_WIZARD_STATE,
        ui: ui(),
        service: null,
        employee: null,
        preselectServiceId: null,
        isSubmitting: false,
      }),
    ).toEqual([{ kind: 'effect', effect: 'close' }]);
  });

  it('closes a deep-linked direct clinic instead of returning to an internal service', () => {
    const hidden = { ...service, isHidden: true } as Service;
    expect(
      planStepBack({
        state: { step: WizardStep.THERAPIST, service: hidden },
        ui: ui(),
        service: hidden,
        employee: null,
        preselectServiceId: 'svc1',
        isSubmitting: false,
      }),
    ).toEqual([{ kind: 'effect', effect: 'close' }]);
  });

  it('re-enters service selection and invalidates the options load from the slot step', () => {
    expect(
      planStepBack({
        state: { step: WizardStep.SLOT, service, employee },
        ui: ui(),
        service,
        employee,
        preselectServiceId: null,
        isSubmitting: false,
      }),
    ).toEqual([
      { kind: 'machine', event: { type: 'SELECT_SERVICE', service } },
      { kind: 'effect', effect: 'reset-auto-selected-pair' },
      { kind: 'effect', effect: 'invalidate-practitioner-options' },
    ]);
  });

  it('leaves the choice step and clears options', () => {
    const ops = planStepBack({
      state: { step: WizardStep.THERAPIST, service },
      ui: ui({ showingChoiceStep: true }),
      service,
      employee: null,
      preselectServiceId: null,
      isSubmitting: false,
    });
    expect(ops[0]).toEqual({ kind: 'ui', action: { type: 'EXIT_CHOICE_STEP' } });
    expect(ops).toContainEqual({ kind: 'effect', effect: 'invalidate-practitioner-options' });
    expect(ops).toContainEqual({ kind: 'ui', action: { type: 'SET_PRACTITIONER_OPTIONS', opts: null } });
  });

  it('restarts the funnel when the summary jumps to the branch step', () => {
    expect(
      planJumpToScreen('branch', {
        state: { step: WizardStep.SLOT, service, employee },
        ui: ui(),
        service,
        employee,
        preselectServiceId: null,
        isSubmitting: false,
      }),
    ).toEqual([
      { kind: 'machine', event: { type: 'RESET' } },
      { kind: 'ui', action: { type: 'SET_CHOICE', choice: null } },
      { kind: 'ui', action: { type: 'OPEN_INITIAL_BRANCH_PICK' } },
    ]);
  });

  it('does nothing while a booking is submitting or recovery is pending', () => {
    const context = {
      state: INITIAL_WIZARD_STATE,
      ui: ui({ paymentRecovery: { bookingId: 'b1', invoiceId: 'i1' } }),
      service,
      employee,
      preselectServiceId: null,
      isSubmitting: false,
    };
    expect(planJumpToScreen('service', context)).toEqual([]);
    // Step-back is only frozen by a completed/recovery booking, not by the
    // in-flight submit flag — keep the original contract explicit here.
    expect(planStepBack(context)).toEqual([]);
    expect(planStepBack({ ...context, ui: ui() })).toEqual([{ kind: 'effect', effect: 'close' }]);
  });

  it('finalizes the pending therapist when a branch is picked', () => {
    const pending = { id: 'emp9' } as EmployeeWithUser;
    expect(
      planBranchSelect(branch, { service, pendingEmployee: pending }),
    ).toEqual([
      { kind: 'ui', action: { type: 'PICK_BRANCH', branch } },
      { kind: 'machine', event: { type: 'SELECT_EMPLOYEE', employee: pending } },
      { kind: 'ui', action: { type: 'CLEAR_LOCKED_EMPLOYEE' } },
    ]);
  });

  it('clears the locked therapist when cancelling the branch pick in therapist-first mode', () => {
    expect(planBranchCancel('therapist', employee)).toEqual([
      { kind: 'ui', action: { type: 'CANCEL_BRANCH_PICK' } },
      { kind: 'ui', action: { type: 'CLEAR_LOCKED_EMPLOYEE' } },
    ]);
    expect(planBranchCancel('service', employee)).toEqual([
      { kind: 'ui', action: { type: 'CANCEL_BRANCH_PICK' } },
    ]);
  });
});
