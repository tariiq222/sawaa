import { auditFinanceBookings, parseHalalas, type AuditCategory } from './audit-finance-bookings';

function transactionWith(rows: unknown[]): {
  prisma: { $transaction: jest.Mock };
  executeRaw: jest.Mock;
  queryRaw: jest.Mock;
} {
  const executeRaw = jest.fn().mockResolvedValue(0);
  const queryRaw = jest.fn();
  for (const row of rows) queryRaw.mockResolvedValueOnce(row);
  const tx = { $executeRaw: executeRaw, $queryRaw: queryRaw };
  const prisma = {
    $transaction: jest.fn(async (callback: (value: unknown) => Promise<unknown>) => callback(tx)),
  };
  return { prisma, executeRaw, queryRaw };
}

describe('auditFinanceBookings', () => {
  it('converts numeric text exactly and rejects fractions or unsafe amounts', () => {
    expect(parseHalalas('10000.00')).toBe(10_000);
    expect(parseHalalas(25n)).toBe(25);
    expect(() => parseHalalas('10000.01')).toThrow('Non-integral');
    expect(() => parseHalalas(String(Number.MAX_SAFE_INTEGER + 1))).toThrow('safe integer');
  });

  it('reports every category as review-only and excludes false refund double-subtraction', async () => {
    const fixture = transactionWith([
      [{ database: 'sawaa_audit_test', schema: 'public' }],
      [
        { invoiceId: 'invoice-over', bookingId: 'booking-over', packagePurchaseId: null, invoiceTotal: '10000.00', grossSettled: '15000.00', refundedSettled: '2000.00' },
        { invoiceId: 'invoice-package-over', bookingId: null, packagePurchaseId: 'package-1', invoiceTotal: '300.00', grossSettled: '500.00', refundedSettled: '0.00' },
      ],
      [{ paymentId: 'payment-match', invoiceId: 'invoice-ok', recordedRefunded: '9000.00', completedRefunded: '9000.00' }],
      [{ invoiceId: 'invoice-deposit', bookingId: 'booking-deposit', invoiceStatus: 'PAID', bookingStatus: 'DEPOSIT_PAID' }],
      [{ evidenceId: 'Booking:booking-missing:client', entityId: 'booking-missing', entityType: 'Booking', referenceType: 'client', referenceId: 'client-missing', personExists: false }],
      [{ evidenceId: 'IntakeResponse:booking-duplicate:form-1', bookingId: 'booking-duplicate', formId: 'form-1', sourceIds: ['response-a', 'response-b'], currentCount: 2 }],
      [{ id: 'outbox-old', aggregateId: 'booking-outbox', status: 'PENDING', createdAt: '2026-09-01T00:00:00.000Z' }],
    ]);

    const page = await auditFinanceBookings(fixture.prisma as never, {
      now: new Date('2026-09-05T00:00:00.000Z'),
    });

    expect(fixture.executeRaw).toHaveBeenCalledTimes(1);
    expect(fixture.queryRaw).toHaveBeenCalledTimes(7);
    expect(page.complete).toBe(true);
    expect(page.completion).toBe('FULL_FRESH_PASS');
    expect(page.totalFindings).toBe(6);
    expect(page.findings.map((finding) => finding.category).sort()).toEqual([
      'INVOICE_BOOKING_STATUS_MISMATCH', 'INVOICE_OVER_COLLECTION', 'INVOICE_OVER_COLLECTION', 'INTAKE_CURRENT_DUPLICATE',
      'MISSING_PERSON_REFERENCE', 'STALLED_OUTBOX',
    ].sort());
    expect(page.findings.every((finding) => finding.severity === 'REVIEW_REQUIRED')).toBe(true);
    expect(page.findings.find((finding) => finding.category === 'INVOICE_OVER_COLLECTION')).toMatchObject({
      amountHalalas: 10_000, grossSettledHalalas: 15_000, refundedSettledHalalas: 2_000,
    });
    expect(page.findings).toContainEqual(expect.objectContaining({
      invoiceId: 'invoice-package-over', packagePurchaseId: 'package-1',
    }));
    expect(page.findings.some((finding) => finding.paymentId === 'payment-match')).toBe(false);
  });

  it('uses an independent resumable cursor per category and marks a short page unfinished', async () => {
    const invoices = Array.from({ length: 101 }, (_, index) => ({
      invoiceId: `invoice-${String(index).padStart(3, '0')}`,
      bookingId: `booking-${index}`,
      invoiceTotal: '1.00', grossSettled: '2.00', refundedSettled: '0.00',
    }));
    const fixture = transactionWith([
      [{ database: 'sawaa_audit_test', schema: 'public' }], invoices, [], [], [], [], [],
    ]);
    const page = await auditFinanceBookings(fixture.prisma as never, { batchSize: 100 });

    expect(page.complete).toBe(false);
    expect(page.completion).toBe('PAGE_ONLY');
    expect(page.totalFindings).toBe(100);
    expect(page.counts.INVOICE_OVER_COLLECTION).toBe(100);
    expect(page.scanned.INVOICE_OVER_COLLECTION).toBe(100);
    expect(page.nextCursors.INVOICE_OVER_COLLECTION).toBe('invoice-099');
    expect(page.nextCursors.PAYMENT_REFUND_MISMATCH).toBeUndefined();
    expect(page.findings.map((finding) => finding.invoiceId)).not.toContain('invoice-100');
  });

  it('does not treat forged cursors or caller-skipped categories as a verified full pass', async () => {
    const fixture = transactionWith([
      [{ database: 'sawaa_audit_test', schema: 'public' }], [], [], [], [], [], [],
    ]);
    const forged = await auditFinanceBookings(fixture.prisma as never, {
      cursors: { INVOICE_OVER_COLLECTION: 'forged-high-cursor' },
    });
    expect(forged.complete).toBe(false);
    expect(forged.completion).toBe('RESUMED_UNVERIFIED');

    const skipped = transactionWith([[{ database: 'sawaa_audit_test', schema: 'public' }]]);
    const skippedPage = await auditFinanceBookings(skipped.prisma as never, {
      completedCategories: [
        'INVOICE_OVER_COLLECTION', 'PAYMENT_REFUND_MISMATCH', 'INVOICE_BOOKING_STATUS_MISMATCH',
        'MISSING_PERSON_REFERENCE', 'INTAKE_CURRENT_DUPLICATE', 'STALLED_OUTBOX',
      ],
    });
    expect(skippedPage.complete).toBe(false);
    expect(skippedPage.completion).toBe('RESUMED_UNVERIFIED');
    expect(skipped.queryRaw).toHaveBeenCalledTimes(1);
  });

  it('produces a stable checksum for the same page and rejects invalid page settings', async () => {
    const responses = [
      [{ database: 'sawaa_audit_test', schema: 'public' }], [], [], [], [], [], [],
    ];
    const first = transactionWith(responses);
    const second = transactionWith(responses);
    const options = { now: new Date('2026-09-05T00:00:00.000Z') };
    const firstPage = await auditFinanceBookings(first.prisma as never, options);
    const secondPage = await auditFinanceBookings(second.prisma as never, options);
    expect(firstPage.checksum).toBe(secondPage.checksum);
    expect(firstPage.counts).toEqual(expect.objectContaining({} as Record<AuditCategory, number>));
    await expect(auditFinanceBookings(first.prisma as never, { batchSize: 101 })).rejects.toThrow('batchSize');
    await expect(auditFinanceBookings(first.prisma as never, { stalledOutboxHours: 0 })).rejects.toThrow('stalledOutboxHours');
  });
});
