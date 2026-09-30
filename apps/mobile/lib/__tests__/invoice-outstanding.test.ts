import { getOutstandingHalalas } from '../invoice-outstanding';

const invoice = (total: unknown, payments: Array<{ status: string; amount: unknown }> = []) =>
  ({ id: 'inv-1', status: 'ISSUED', total, payments: payments.map((p, i) => ({ id: `p-${i}`, ...p })) }) as never;

describe('getOutstandingHalalas', () => {
  it('returns the full total when nothing is committed', () => {
    expect(getOutstandingHalalas(invoice('25000.00'))).toBe(25000);
    expect(getOutstandingHalalas(invoice(25000))).toBe(25000);
  });

  it('subtracts completed, pending and pending-verification payments', () => {
    expect(getOutstandingHalalas(invoice('25000', [
      { status: 'COMPLETED', amount: '5000.00' },
      { status: 'PENDING', amount: 2000 },
      { status: 'PENDING_VERIFICATION', amount: '1000' },
    ]))).toBe(17000);
  });

  it('ignores failed and refunded payments', () => {
    expect(getOutstandingHalalas(invoice('25000', [
      { status: 'FAILED', amount: '25000' },
      { status: 'REFUNDED', amount: '5000' },
    ]))).toBe(25000);
  });

  it('reports a settled invoice as zero', () => {
    expect(getOutstandingHalalas(invoice('25000', [{ status: 'COMPLETED', amount: '25000' }]))).toBe(0);
  });

  it('refuses to guess when the total or a counted payment amount is unusable', () => {
    expect(getOutstandingHalalas(invoice(undefined))).toBeNull();
    expect(getOutstandingHalalas(invoice('abc'))).toBeNull();
    expect(getOutstandingHalalas(invoice('25000', [{ status: 'COMPLETED', amount: undefined }]))).toBeNull();
  });
});
