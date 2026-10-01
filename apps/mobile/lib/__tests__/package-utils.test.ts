import type { ClientPackageCredit } from '@sawaa/shared/types';

import {
  PACKAGE_PAYMENT_MAX_POLLS,
  PACKAGE_PAYMENT_MAX_POLLS_AFTER_CLOSE,
  creditLockReason,
  formatHalalas,
  isCreditBookable,
  isPaidAttemptKeyError,
  packageCheckoutSignalFromBrowser,
  packageCheckoutSignalFromRedirect,
  packagePaymentState,
  packagePurchaseErrorKey,
  parseQueryParams,
} from '../package-utils';

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

  it('treats a gateway decline as failed unless the server already activated the purchase', () => {
    expect(packagePaymentState('PENDING', false, { signal: 'failed' })).toBe('failed');
    expect(packagePaymentState(undefined, true, { signal: 'failed' })).toBe('failed');
    expect(packagePaymentState('ACTIVE', false, { signal: 'failed' })).toBe('success');
  });

  it('stops waiting after a bounded number of still-pending reads', () => {
    expect(packagePaymentState('PENDING', false, { pendingPolls: PACKAGE_PAYMENT_MAX_POLLS - 1 })).toBe('pending');
    expect(packagePaymentState('PENDING', false, { pendingPolls: PACKAGE_PAYMENT_MAX_POLLS })).toBe('unconfirmed');
    expect(packagePaymentState('PENDING', false, { signal: 'closed', pendingPolls: PACKAGE_PAYMENT_MAX_POLLS_AFTER_CLOSE })).toBe('unconfirmed');
    expect(packagePaymentState('ACTIVE', false, { pendingPolls: 99 })).toBe('success');
  });

  it('reads checkout signals from the gateway redirect and the browser result', () => {
    const params = parseQueryParams('sawa://packages/return?id=pay_1&status=failed&message=Insufficient%20funds');
    expect(params).toEqual({ id: 'pay_1', status: 'failed', message: 'Insufficient funds' });
    expect(packageCheckoutSignalFromRedirect(params.status)).toBe('failed');
    expect(packageCheckoutSignalFromRedirect('PAID')).toBe('paid');
    expect(packageCheckoutSignalFromRedirect(undefined)).toBe('unknown');
    expect(packageCheckoutSignalFromBrowser('cancel')).toBe('closed');
    expect(packageCheckoutSignalFromBrowser('dismiss')).toBe('closed');
    expect(packageCheckoutSignalFromBrowser('success')).toBe('unknown');
  });

  it('maps checkout start errors to clear messages', () => {
    const error = (status: number, message: string) => ({ response: { status, data: { message } } });
    expect(packagePurchaseErrorKey(error(409, 'Another checkout is already pending for this client and package'))).toBe('packages.purchaseConflict');
    expect(packagePurchaseErrorKey(error(409, 'This purchase has already been paid'))).toBe('packages.purchaseAlreadyPaid');
    expect(packagePurchaseErrorKey(new Error('network'))).toBe('packages.purchaseError');
    expect(isPaidAttemptKeyError(error(400, 'This purchase has already been paid'))).toBe(true);
    expect(isPaidAttemptKeyError(error(409, 'This purchase has already been paid'))).toBe(false);
  });
});
