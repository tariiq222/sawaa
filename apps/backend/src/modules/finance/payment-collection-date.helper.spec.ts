import { paymentCollectionDate, paymentCollectionDateSql, paymentCollectionDateWhere, paymentCollectionDay } from './payment-collection-date.helper';

const createdAt = new Date('2026-10-05T10:00:00Z');
const processedAt = new Date('2026-10-06T10:00:00Z');
const effectiveReceivedAt = new Date('2026-09-01T21:00:00Z');

describe('payment collection semantics', () => {
  it('prefers the documented receipt independently of both system dates', () => {
    const payment = {createdAt, processedAt, effectiveReceivedAt};
    expect(paymentCollectionDate(payment, 'CREATED')).toEqual(effectiveReceivedAt);
    expect(paymentCollectionDate(payment, 'PROCESSED')).toEqual(effectiveReceivedAt);
    expect(payment).toEqual({createdAt, processedAt, effectiveReceivedAt});
  });
  it('preserves separate CREATED and nullable PROCESSED fallback semantics', () => {
    expect(paymentCollectionDate({createdAt, processedAt, effectiveReceivedAt: null}, 'CREATED')).toEqual(createdAt);
    expect(paymentCollectionDate({createdAt, processedAt, effectiveReceivedAt: null}, 'PROCESSED')).toEqual(processedAt);
    expect(paymentCollectionDate({createdAt, processedAt: null, effectiveReceivedAt: null}, 'PROCESSED')).toBeNull();
  });
  it.each([
    ['2026-09-01T20:59:59.999Z', '2026-09-01'],
    ['2026-09-01T21:00:00.000Z', '2026-09-02'],
  ])('groups %s in Riyadh day %s independently of host timezone', (iso, day) => {
    expect(paymentCollectionDay({createdAt, effectiveReceivedAt: new Date(iso)}, 'CREATED')).toBe(day);
  });
  it('keeps nullable PROCESSED range and SQL fallbacks aligned', () => {
    const range = {gte: new Date('2026-09-01'), lt: new Date('2026-10-01')};
    expect(paymentCollectionDateWhere(range, 'PROCESSED')).toEqual({OR: [
      {effectiveReceivedAt: range}, {effectiveReceivedAt: null, processedAt: range},
    ]});
    expect(paymentCollectionDateSql('PROCESSED').sql).toBe('COALESCE(p."effectiveReceivedAt", p."processedAt")');
  });
});
