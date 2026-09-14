import type { ClientPackageCredit } from '@sawaa/shared/types';

import { creditLockReason, formatHalalas, isCreditBookable, packagePaymentState } from '../package-utils';

const credit = (overrides: Partial<ClientPackageCredit> = {}): ClientPackageCredit => ({
  id: 'credit-1',
  serviceId: 'service-1',
  employeeId: 'employee-1',
  durationOptionId: 'duration-1',
  serviceNameAr: 'جلسة',
  serviceNameEn: 'Session',
  employeeNameAr: 'مختصة',
  employeeNameEn: 'Therapist',
  durationLabelAr: 'ساعة',
  durationLabelEn: '1 hour',
  durationMins: 60,
  serviceIsBookable: true,
  remaining: 2,
  constraints: [],
  totalQuantity: 2,
  usedQuantity: 0,
  reservedQuantity: 0,
  unitPriceSnapshot: 10000,
  availability: { bookable: true, reason: null },
  ...overrides,
});

describe('package credit presentation', () => {
  it('keeps an available credit actionable and identifies locked credits', () => {
    expect(isCreditBookable(credit())).toBe(true);
    expect(creditLockReason(credit())).toBeNull();
    expect(isCreditBookable(credit({ remaining: 0 }))).toBe(false);
    expect(creditLockReason(credit({ remaining: 0 }))).toBe('depleted');
    expect(creditLockReason(credit({ availability: { bookable: false, reason: 'sequence' } }))).toBe('unavailable');
    expect(creditLockReason(credit({ serviceIsBookable: false }))).toBe('unsupported');
  });

  it('formats integer halalas as money', () => {
    expect(formatHalalas(90000, 'en-US')).toContain('900.00');
  });

  it('keeps the hosted return pending until the server reports activation', () => {
    expect(packagePaymentState('PENDING', false)).toBe('pending');
    expect(packagePaymentState('ACTIVE', false)).toBe('success');
    expect(packagePaymentState(undefined, false)).toBe('failed');
  });
});
