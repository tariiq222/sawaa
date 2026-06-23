import { describe, it, expect } from 'vitest';
import {
  reduce,
  INITIAL_WIZARD_STATE,
  WizardStep,
  WizardState,
} from './booking-wizard';
import type { Service } from '../types/service';
import type { EmployeeWithUser } from '../types/employee';
import type { AvailableSlot } from '../types/guest';
import type { GuestClientInfo } from '../types/guest';

const mockService: Service = {
  id: 'svc-1',
  nameAr: 'استشارة',
  nameEn: 'Consultation',
  descriptionAr: null,
  descriptionEn: null,
  categoryId: 'cat-1',
  price: 10000,
  duration: 30,
  isActive: true,
  isHidden: false,
  hidePriceOnBooking: false,
  hideDurationOnBooking: false,
  bufferMinutes: 0,
  depositEnabled: false,
  depositPercent: null,
  maxParticipants: 1,
  minLeadMinutes: null,
  maxAdvanceDays: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockEmployee: EmployeeWithUser = {
  id: 'emp-1',
  userId: 'u1',
  specialty: 'Psychiatry',
  specialtyAr: 'طب نفسي',
  bio: null,
  bioAr: null,
  experience: 10,
  education: 'MBBS',
  educationAr: 'طب',
  rating: 4.8,
  reviewCount: 42,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  user: {
    id: 'u1',
    firstName: 'Ahmed',
    lastName: 'Ali',
    email: 'a@b.com',
    phone: '+966501234567',
    avatarUrl: null,
  },
};

const mockSlot: AvailableSlot = {
  startTime: '2026-04-20T09:00:00Z',
  endTime: '2026-04-20T09:30:00Z',
};

const mockClient: GuestClientInfo = {
  name: 'Ahmed',
  phone: '+966501234567',
  email: 'ahmed@example.com',
};

function state<S extends WizardState>(s: S): S {
  return s;
}

describe('booking-wizard reducer', () => {
  it('initial state is SERVICE', () => {
    expect(INITIAL_WIZARD_STATE).toEqual({ step: WizardStep.SERVICE });
  });

  it('SERVICE -> THERAPIST on SELECT_SERVICE', () => {
    const next = reduce(INITIAL_WIZARD_STATE, { type: 'SELECT_SERVICE', service: mockService });
    expect(next).toEqual(state({ step: WizardStep.THERAPIST, service: mockService }));
  });

  it('THERAPIST -> SLOT on SELECT_EMPLOYEE', () => {
    const s = state({ step: WizardStep.THERAPIST, service: mockService });
    const next = reduce(s, { type: 'SELECT_EMPLOYEE', employee: mockEmployee });
    expect(next).toEqual(state({ step: WizardStep.SLOT, service: mockService, employee: mockEmployee }));
  });

  it('THERAPIST -> THERAPIST on SELECT_SERVICE (change service)', () => {
    const s = state({ step: WizardStep.THERAPIST, service: mockService });
    const otherService: Service = { ...mockService, id: 'svc-2', nameEn: 'Checkup', nameAr: 'فحص' };
    const next = reduce(s, { type: 'SELECT_SERVICE', service: otherService });
    expect(next).toEqual(state({ step: WizardStep.THERAPIST, service: otherService }));
  });

  it('SLOT -> INFO_OTP on SELECT_SLOT', () => {
    const s = state({ step: WizardStep.SLOT, service: mockService, employee: mockEmployee });
    const next = reduce(s, { type: 'SELECT_SLOT', slot: mockSlot });
    expect(next).toEqual(state({
      step: WizardStep.INFO_OTP,
      service: mockService,
      employee: mockEmployee,
      slot: mockSlot,
    }));
  });

  it('SLOT -> SLOT on SELECT_EMPLOYEE (change therapist)', () => {
    const s = state({ step: WizardStep.SLOT, service: mockService, employee: mockEmployee });
    const otherEmployee: EmployeeWithUser = { ...mockEmployee, id: 'emp-2', user: { ...mockEmployee.user, firstName: 'Sara' } };
    const next = reduce(s, { type: 'SELECT_EMPLOYEE', employee: otherEmployee });
    expect(next).toEqual(state({ step: WizardStep.SLOT, service: mockService, employee: otherEmployee }));
  });

  it('INFO_OTP -> PAYMENT on SUBMIT_INFO', () => {
    const s = state({ step: WizardStep.INFO_OTP, service: mockService, employee: mockEmployee, slot: mockSlot });
    const next = reduce(s, { type: 'SUBMIT_INFO', client: mockClient });
    expect(next).toEqual(state({
      step: WizardStep.PAYMENT,
      service: mockService,
      employee: mockEmployee,
      slot: mockSlot,
      client: mockClient,
    }));
  });

  it('INFO_OTP -> SLOT on SELECT_EMPLOYEE (go back)', () => {
    const s = state({ step: WizardStep.INFO_OTP, service: mockService, employee: mockEmployee, slot: mockSlot });
    const otherEmployee: EmployeeWithUser = { ...mockEmployee, id: 'emp-2', user: { ...mockEmployee.user, firstName: 'Sara' } };
    const next = reduce(s, { type: 'SELECT_EMPLOYEE', employee: otherEmployee });
    expect(next).toEqual(state({ step: WizardStep.SLOT, service: mockService, employee: otherEmployee }));
  });

  it('INFO_OTP -> INFO_OTP on SELECT_SLOT (change slot)', () => {
    const s = state({ step: WizardStep.INFO_OTP, service: mockService, employee: mockEmployee, slot: mockSlot });
    const otherSlot: AvailableSlot = { startTime: '2026-04-20T10:00:00Z', endTime: '2026-04-20T10:30:00Z' };
    const next = reduce(s, { type: 'SELECT_SLOT', slot: otherSlot });
    expect(next).toEqual(state({
      step: WizardStep.INFO_OTP,
      service: mockService,
      employee: mockEmployee,
      slot: otherSlot,
    }));
  });

  it('PAYMENT -> CONFIRMATION on INIT_PAYMENT', () => {
    const s = state({
      step: WizardStep.PAYMENT,
      service: mockService,
      employee: mockEmployee,
      slot: mockSlot,
      client: mockClient,
    });
    const next = reduce(s, {
      type: 'INIT_PAYMENT',
      bookingId: 'book-1',
      invoiceId: 'inv-1',
      totalHalalat: 11500,
      redirectUrl: 'https://checkout.moyasar.com/pay/pay_xxx',
    });
    expect(next).toEqual(state({ step: WizardStep.CONFIRMATION, bookingId: 'book-1', status: 'success' }));
  });

  it('PAYMENT -> CONFIRMATION (failed) on PAYMENT_FAIL', () => {
    const s = state({
      step: WizardStep.PAYMENT,
      service: mockService,
      employee: mockEmployee,
      slot: mockSlot,
      client: mockClient,
    });
    const next = reduce(s, { type: 'PAYMENT_FAIL' });
    expect(next).toEqual(state({ step: WizardStep.CONFIRMATION, bookingId: '', status: 'failed' }));
  });

  it('CONFIRMATION -> SERVICE on RESET', () => {
    const s = state({ step: WizardStep.CONFIRMATION, bookingId: 'book-1', status: 'success' });
    const next = reduce(s, { type: 'RESET' });
    expect(next).toEqual({ step: WizardStep.SERVICE });
  });

  it('ignores out-of-order events (noop)', () => {
    expect(reduce(INITIAL_WIZARD_STATE, { type: 'SELECT_EMPLOYEE', employee: mockEmployee })).toEqual(INITIAL_WIZARD_STATE);
    expect(reduce(INITIAL_WIZARD_STATE, { type: 'SELECT_SLOT', slot: mockSlot })).toEqual(INITIAL_WIZARD_STATE);
    expect(reduce(INITIAL_WIZARD_STATE, { type: 'SUBMIT_INFO', client: mockClient })).toEqual(INITIAL_WIZARD_STATE);
    expect(reduce(INITIAL_WIZARD_STATE, { type: 'INIT_PAYMENT', bookingId: 'b1', invoiceId: 'i1', totalHalalat: 100, redirectUrl: '' })).toEqual(INITIAL_WIZARD_STATE);
  });

  it('allows back-navigation via SELECT_SERVICE from SLOT', () => {
    const s = state({ step: WizardStep.SLOT, service: mockService, employee: mockEmployee });
    const next = reduce(s, { type: 'SELECT_SERVICE', service: mockService });
    expect(next).toEqual(state({ step: WizardStep.THERAPIST, service: mockService }));
  });

  // ---- PAYMENT step back-navigation and PAYMENT_SUCCESS path ----------------

  function paymentState() {
    return state({
      step: WizardStep.PAYMENT,
      service: mockService,
      employee: mockEmployee,
      slot: mockSlot,
      client: mockClient,
    })
  }

  it('PAYMENT -> CONFIRMATION (success) on PAYMENT_SUCCESS', () => {
    const next = reduce(paymentState(), { type: 'PAYMENT_SUCCESS', bookingId: 'book-2' })
    expect(next).toEqual(state({ step: WizardStep.CONFIRMATION, bookingId: 'book-2', status: 'success' }))
  })

  it('PAYMENT -> THERAPIST on SELECT_SERVICE (back-nav)', () => {
    const next = reduce(paymentState(), { type: 'SELECT_SERVICE', service: mockService })
    expect(next).toEqual(state({ step: WizardStep.THERAPIST, service: mockService }))
  })

  it('PAYMENT -> SLOT on SELECT_EMPLOYEE (back-nav)', () => {
    const otherEmployee: EmployeeWithUser = {
      ...mockEmployee,
      id: 'emp-2',
      user: { ...mockEmployee.user, firstName: 'Sara' },
    }
    const next = reduce(paymentState(), { type: 'SELECT_EMPLOYEE', employee: otherEmployee })
    expect(next).toEqual(state({ step: WizardStep.SLOT, service: mockService, employee: otherEmployee }))
  })

  it('PAYMENT -> INFO_OTP on SELECT_SLOT (back-nav)', () => {
    const otherSlot: AvailableSlot = {
      startTime: '2026-04-20T10:00:00Z',
      endTime: '2026-04-20T10:30:00Z',
    }
    const next = reduce(paymentState(), { type: 'SELECT_SLOT', slot: otherSlot })
    expect(next).toEqual(state({
      step: WizardStep.INFO_OTP,
      service: mockService,
      employee: mockEmployee,
      slot: otherSlot,
    }))
  })

  // ---- CONFIRMATION is terminal except for RESET -----------------------------

  it('CONFIRMATION ignores non-RESET events (noop)', () => {
    const s = state({ step: WizardStep.CONFIRMATION, bookingId: 'book-1', status: 'success' })
    expect(reduce(s, { type: 'SELECT_SERVICE', service: mockService })).toEqual(s)
    expect(reduce(s, { type: 'SELECT_EMPLOYEE', employee: mockEmployee })).toEqual(s)
    expect(reduce(s, { type: 'SELECT_SLOT', slot: mockSlot })).toEqual(s)
    expect(reduce(s, { type: 'SUBMIT_INFO', client: mockClient })).toEqual(s)
    expect(reduce(s, { type: 'VERIFY_OTP', sessionToken: 'tok' })).toEqual(s)
    expect(reduce(s, { type: 'INIT_PAYMENT', bookingId: 'b2', invoiceId: 'i2', totalHalalat: 100, redirectUrl: 'x' })).toEqual(s)
    expect(reduce(s, { type: 'PAYMENT_SUCCESS', bookingId: 'b2' })).toEqual(s)
    expect(reduce(s, { type: 'PAYMENT_FAIL' })).toEqual(s)
  })

  it('RESET from PAYMENT goes to SERVICE (not affected by current branch)', () => {
    const next = reduce(paymentState(), { type: 'RESET' })
    expect(next).toEqual({ step: WizardStep.SERVICE })
  })

  it('RESET from SLOT goes to SERVICE', () => {
    const s = state({ step: WizardStep.SLOT, service: mockService, employee: mockEmployee })
    expect(reduce(s, { type: 'RESET' })).toEqual({ step: WizardStep.SERVICE })
  })

  it('RESET from THERAPIST goes to SERVICE', () => {
    const s = state({ step: WizardStep.THERAPIST, service: mockService })
    expect(reduce(s, { type: 'RESET' })).toEqual({ step: WizardStep.SERVICE })
  })

  it('RESET from INFO_OTP goes to SERVICE', () => {
    const s = state({ step: WizardStep.INFO_OTP, service: mockService, employee: mockEmployee, slot: mockSlot })
    expect(reduce(s, { type: 'RESET' })).toEqual({ step: WizardStep.SERVICE })
  })

  // ---- Additional edge cases ------------------------------------------------

  it('PAYMENT_SUCCESS carries the bookingId through to CONFIRMATION', () => {
    const next = reduce(paymentState(), { type: 'PAYMENT_SUCCESS', bookingId: 'book-XYZ-789' })
    if (next.step !== WizardStep.CONFIRMATION) throw new Error('expected CONFIRMATION')
    expect(next.bookingId).toBe('book-XYZ-789')
    expect(next.status).toBe('success')
  })

  it('PAYMENT_FAIL yields bookingId="" and status="failed" regardless of state', () => {
    const next = reduce(paymentState(), { type: 'PAYMENT_FAIL' })
    if (next.step !== WizardStep.CONFIRMATION) throw new Error('expected CONFIRMATION')
    expect(next.bookingId).toBe('')
    expect(next.status).toBe('failed')
  })
});