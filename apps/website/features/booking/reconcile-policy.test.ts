import { describe, it, expect } from 'vitest';
import { paidPhase, shouldReconcile } from './reconcile-policy';

describe('shouldReconcile', () => {
  it('is true only on attempts 3 and 8 while pending', () => {
    const hits = Array.from({ length: 10 }, (_, i) => i + 1).filter((n) => shouldReconcile(n, true));
    expect(hits).toEqual([3, 8]);
  });

  it('is false when not pending', () => {
    expect(shouldReconcile(3, false)).toBe(false);
    expect(shouldReconcile(8, false)).toBe(false);
  });

  it('is false once two calls were made', () => {
    expect(shouldReconcile(3, true, 2)).toBe(false);
    expect(shouldReconcile(8, true, 1)).toBe(true);
  });
});

describe('paidPhase', () => {
  it('maps paid payloads', () => {
    expect(paidPhase({ status: 'CONFIRMED', paymentStatus: 'PENDING' })).toBe('success');
    expect(paidPhase({ status: 'PENDING', paymentStatus: 'COMPLETED' })).toBe('success');
    expect(paidPhase({ status: 'DEPOSIT_PAID', paymentStatus: 'COMPLETED' })).toBe('deposit_paid');
  });

  it('returns null for pending, failed or missing payloads', () => {
    expect(paidPhase({ status: 'PENDING', paymentStatus: 'PENDING' })).toBeNull();
    expect(paidPhase({ status: 'CANCELLED', paymentStatus: 'FAILED' })).toBeNull();
    expect(paidPhase(undefined)).toBeNull();
  });
});
