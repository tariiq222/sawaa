import { buildProgramCancellationPreview, resolveProgramRefunds } from './program-cancellation-policy';
const booking = (overrides = {}) => ({ id: 'b1', clientId: 'c1', client: { firstName: 'A', lastName: 'B' }, bookingNumber: 1, status: 'CONFIRMED', checkedInAt: null, isHistoricalImport: false, currency: 'SAR', payments: [{ id: 'p1', invoiceId: 'i1', status: 'COMPLETED', amount: 10000, refundedAmount: 2000, currency: 'SAR', method: 'CASH', gatewayRef: null, refundRequests: [{ id: 'r1', status: 'PROCESSING', amount: 1000 }] }], ...overrides });
const program = { id: 'g1', name: 'Group', status: 'SCHEDULED', startDate: new Date('2030-01-01') };
const now = new Date('2029-01-01');
describe('center program cancellation policy', () => {
  it('quotes full available capture before start, subtracting completed and reserved claims', () => {
    const quote = buildProgramCancellationPreview(program, [booking()], now);
    expect(quote.hasStarted).toBe(false);
    expect(quote.participants[0]).toMatchObject({ paidAmount: 10000, alreadyRefundedAmount: 2000, pendingRefundAmount: 1000, maxRefundAmount: 7000, refundAmount: 7000 });
    expect(resolveProgramRefunds(quote)).toEqual(new Map([['b1', 7000]]));
    expect(() => resolveProgramRefunds(quote, [{ bookingId: 'b1', amount: 1000 }])).toThrow();
  });
  it.each([{ startDate: new Date('2020-01-01') }, { startDate: null }])('requires manual per-participant amount when delivery evidence exists', override => {
    const quote = buildProgramCancellationPreview({ ...program, ...override }, [booking({ checkedInAt: now })], now);
    expect(quote.hasStarted).toBe(true);
    expect(quote.participants[0].refundAmount).toBeNull();
    expect(() => resolveProgramRefunds(quote)).toThrow();
    expect(resolveProgramRefunds(quote, [{ bookingId: 'b1', amount: 0 }]).get('b1')).toBe(0);
    for (const amount of [-1, 7001, 1.2]) expect(() => resolveProgramRefunds(quote, [{ bookingId: 'b1', amount }])).toThrow();
  });
  it('keeps unscheduled undelivered programs before start and changes token for mode, money, or participants', () => {
    const quote = buildProgramCancellationPreview({ ...program, startDate: null }, [booking()], now);
    expect(quote.hasStarted).toBe(false);
    expect(buildProgramCancellationPreview(program, [booking()], new Date('2031-01-01')).quoteToken).not.toBe(quote.quoteToken);
    expect(buildProgramCancellationPreview({ ...program, startDate: null }, [booking({ payments: [] })], now).quoteToken).not.toBe(quote.quoteToken);
    expect(buildProgramCancellationPreview({ ...program, startDate: null }, [], now).quoteToken).not.toBe(quote.quoteToken);
  });
  it('includes completed/historical participants for financial assessment without deciding their lifecycle', () => {
    const quote = buildProgramCancellationPreview(program, [booking({ status: 'COMPLETED', isHistoricalImport: true })], now);
    expect(quote.hasStarted).toBe(true);
    expect(quote.participants).toHaveLength(1);
    expect(() => resolveProgramRefunds(quote, [{ bookingId: 'alien', amount: 0 }])).toThrow();
    expect(() => resolveProgramRefunds(quote, [{ bookingId: 'b1', amount: 0 }, { bookingId: 'b1', amount: 0 }])).toThrow();
  });
});
