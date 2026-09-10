import { randomUUID } from 'node:crypto';
import { AppMetricsService, type FinancialMetricsSnapshot } from '../../../src/infrastructure/telemetry/app-metrics.service';
import { PrismaService } from '../../../src/infrastructure/database';
import { getRealE2eDatabaseUrl } from '../../helpers/create-real-e2e-app';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

function outboxCount(snapshot: FinancialMetricsSnapshot, status: 'pending' | 'failed'): number {
  return snapshot.outbox.find((row) =>
    row.eventType === 'finance.payment.completed' && row.status === status,
  )?.count ?? 0;
}

describeRealE2e('financial metrics persisted aggregate collection', () => {
  const ids = {
    mismatchInvoice: randomUUID(),
    mismatchPayment: randomUUID(),
    overInvoice: randomUUID(),
    overPayment: randomUUID(),
    completedRefund: randomUUID(),
    unknownRefund: randomUUID(),
    manualRefund: randomUUID(),
    pendingOutbox: randomUUID(),
    failedOutbox: randomUUID(),
  };
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL = getRealE2eDatabaseUrl();
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.outboxEvent.deleteMany({ where: { id: { in: [ids.pendingOutbox, ids.failedOutbox] } } });
    await prisma.refundRequest.deleteMany({ where: { id: { in: [ids.completedRefund, ids.unknownRefund, ids.manualRefund] } } });
    await prisma.payment.deleteMany({ where: { id: { in: [ids.mismatchPayment, ids.overPayment] } } });
    await prisma.invoice.deleteMany({ where: { id: { in: [ids.mismatchInvoice, ids.overInvoice] } } });
    await prisma.$disconnect();
  });

  it('collects exact deltas from aggregate SQL and exposes bounded live samples', async () => {
    const metrics = new AppMetricsService(prisma);
    const before = await metrics.refreshFinancialMetrics(true);

    await prisma.invoice.createMany({ data: [
      {
        id: ids.mismatchInvoice, branchId: 'o4-metrics-branch', clientId: 'o4-metrics-client',
        employeeId: 'o4-metrics-employee', bookingId: `o4-metrics-booking-${ids.mismatchInvoice}`,
        subtotal: 10_000, vatRate: 0, vatAmt: 0, total: 10_000, status: 'PAID',
      },
      {
        id: ids.overInvoice, branchId: 'o4-metrics-branch', clientId: 'o4-metrics-client',
        employeeId: 'o4-metrics-employee', bookingId: `o4-metrics-booking-${ids.overInvoice}`,
        subtotal: 5_000, vatRate: 0, vatAmt: 0, total: 5_000, status: 'PAID',
      },
    ] });
    await prisma.payment.createMany({ data: [
      { id: ids.mismatchPayment, invoiceId: ids.mismatchInvoice, amount: 5_000, method: 'CASH', status: 'COMPLETED' },
      { id: ids.overPayment, invoiceId: ids.overInvoice, amount: 7_000, method: 'CASH', status: 'COMPLETED' },
    ] });
    await prisma.refundRequest.createMany({ data: [
      {
        id: ids.completedRefund, invoiceId: ids.mismatchInvoice, paymentId: ids.mismatchPayment,
        clientId: 'o4-metrics-client', amount: 6_000, status: 'COMPLETED', providerState: 'CONFIRMED',
      },
      {
        id: ids.unknownRefund, invoiceId: ids.mismatchInvoice, paymentId: ids.mismatchPayment,
        clientId: 'o4-metrics-client', amount: 100, status: 'PROCESSING', providerState: 'CALL_UNKNOWN',
      },
      {
        id: ids.manualRefund, invoiceId: ids.mismatchInvoice, paymentId: ids.mismatchPayment,
        clientId: 'o4-metrics-client', amount: 100, status: 'MANUAL_REVIEW', providerState: 'MANUAL_REVIEW',
      },
    ] });
    await prisma.outboxEvent.createMany({ data: [
      {
        id: ids.pendingOutbox, aggregateId: 'o4-metrics-pending', eventType: 'finance.payment.completed',
        payload: {}, status: 'PENDING', createdAt: new Date(Date.now() - 120_000),
      },
      {
        id: ids.failedOutbox, aggregateId: 'o4-metrics-failed', eventType: 'finance.payment.completed',
        payload: {}, status: 'FAILED', failedAt: new Date(),
      },
    ] });

    // Other critical suites may leave older pending events; measure the oldest
    // persisted row rather than assuming this fixture is the only pending row.
    const oldestPending = await prisma.outboxEvent.findFirstOrThrow({
      where: { eventType: 'finance.payment.completed', status: 'PENDING' },
      orderBy: { createdAt: 'asc' }, select: { createdAt: true },
    });
    const collectionStartedAt = Date.now();
    const after = await metrics.refreshFinancialMetrics(true);
    const collectionFinishedAt = Date.now();
    expect(after.refundExceedsSettledInvoices).toBe(before.refundExceedsSettledInvoices + 1);
    expect(after.overcollectedInvoices).toBe(before.overcollectedInvoices + 1);
    expect(after.providerUnknown).toBe(before.providerUnknown + 1);
    expect(after.refundManualReviews).toBe(before.refundManualReviews + 1);
    expect(outboxCount(after, 'pending')).toBe(outboxCount(before, 'pending') + 1);
    expect(outboxCount(after, 'failed')).toBe(outboxCount(before, 'failed') + 1);

    const output = await metrics.registry.metrics();
    expect(output).toContain('financial_outbox_events{event_type="finance.payment.completed",status="pending"}');
    const pendingAge = Number(output.match(
      /financial_outbox_oldest_pending_age_seconds\{event_type="finance\.payment\.completed"\} ([0-9.]+)/,
    )?.[1]);
    expect(pendingAge).toBeGreaterThanOrEqual((collectionStartedAt - oldestPending.createdAt.getTime()) / 1_000 - 1);
    expect(pendingAge).toBeLessThanOrEqual((collectionFinishedAt - oldestPending.createdAt.getTime()) / 1_000 + 1);
    expect(output).not.toContain(ids.pendingOutbox);
    expect(output).not.toContain('o4-metrics-client');
  });
});
