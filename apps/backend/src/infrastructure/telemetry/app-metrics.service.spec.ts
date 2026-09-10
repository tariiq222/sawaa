import { AppMetricsService, type FinancialMetricsSnapshot } from './app-metrics.service';

const snapshot = (overrides: Partial<FinancialMetricsSnapshot> = {}): FinancialMetricsSnapshot => ({
  outbox: [],
  refundExceedsSettledInvoices: 0,
  overcollectedInvoices: 0,
  providerUnknown: 0,
  refundManualReviews: 0,
  ...overrides,
});

describe('AppMetricsService financial metrics', () => {
  it('exports aggregate financial state with persisted bounded labels', async () => {
    const metrics = new AppMetricsService();
    await metrics.collectFinancialMetrics(async () => snapshot({
      outbox: [
        { eventType: 'finance.payment.completed', status: 'pending', count: 3, oldestAgeSeconds: 42 },
        { eventType: 'finance.refund.completed', status: 'failed', count: 1 },
      ],
      refundExceedsSettledInvoices: 2,
      overcollectedInvoices: 1,
      providerUnknown: 4,
      refundManualReviews: 5,
    }));

    const output = await metrics.registry.metrics();
    expect(output).toContain('financial_outbox_events{event_type="finance.payment.completed",status="pending"} 3');
    expect(output).toContain('financial_outbox_oldest_pending_age_seconds{event_type="finance.payment.completed"} 42');
    expect(output).toContain('financial_refund_exceeds_settled_invoices 2');
    expect(output).toContain('financial_overcollected_invoices 1');
    expect(output).toContain('financial_provider_unknown 4');
    expect(output).toContain('financial_refund_manual_reviews 5');
  });

  it('collapses and sums unknown or duplicate tuples without dropping counts', async () => {
    const metrics = new AppMetricsService();
    metrics.recordFinancialMetrics(snapshot({
      outbox: [
        { eventType: 'finance.payment.completed:payment-id-123', status: 'pending', count: 2, oldestAgeSeconds: 99 },
        { eventType: 'finance.payment.completed', status: 'arbitrary-error', count: 3 },
        { eventType: 'finance.payment.completed', status: 'pending', count: 4, oldestAgeSeconds: 12 },
        { eventType: 'finance.payment.completed', status: 'pending', count: 5, oldestAgeSeconds: 42 },
      ],
    }));

    const output = await metrics.registry.metrics();
    expect(output).toContain('financial_outbox_events{event_type="unknown",status="pending"} 2');
    expect(output).toContain('financial_outbox_events{event_type="finance.payment.completed",status="unknown"} 3');
    expect(output).toContain('financial_outbox_events{event_type="finance.payment.completed",status="pending"} 9');
    expect(output).toContain('financial_outbox_oldest_pending_age_seconds{event_type="finance.payment.completed"} 42');
    expect(output).toContain('financial_outbox_oldest_pending_age_seconds{event_type="unknown"} 99');
    expect(output).not.toContain('payment-id-123');
  });

  it('clears disappeared outbox series and clamps invalid values', async () => {
    const metrics = new AppMetricsService();
    metrics.recordFinancialMetrics(snapshot({
      outbox: [{ eventType: 'finance.payment.failed', status: 'pending', count: 9, oldestAgeSeconds: 12 }],
      refundExceedsSettledInvoices: Number.NaN,
      overcollectedInvoices: -1,
      providerUnknown: Number.POSITIVE_INFINITY,
    }));
    metrics.recordFinancialMetrics(snapshot());

    const output = await metrics.registry.metrics();
    expect(output).not.toContain('finance.payment.failed');
    expect(output).toContain('financial_refund_exceeds_settled_invoices 0');
    expect(output).toContain('financial_overcollected_invoices 0');
  });

  it('queries aggregate state once and reuses it for scrapes inside the TTL', async () => {
    const prisma = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ eventType: 'finance.payment.completed', status: 'pending', count: 2, oldestAgeSeconds: 15 }])
        .mockResolvedValueOnce([{ refundExceedsSettledInvoices: 1, overcollectedInvoices: 2 }])
        .mockResolvedValueOnce([{ providerUnknown: 3, refundManualReviews: 4 }]),
    };
    const metrics = new AppMetricsService(prisma as never);

    const first = await metrics.refreshFinancialMetrics(true);
    const cached = await metrics.refreshFinancialMetrics();

    expect(first).toEqual(cached);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    const output = await metrics.registry.metrics();
    expect(output).toContain('financial_outbox_events{event_type="finance.payment.completed",status="pending"} 2');
    expect(output).toContain('financial_overcollected_invoices 2');
    expect(output).not.toContain('database_pool_saturation_ratio');
    expect(output).not.toContain('database_deadlocks_total');
  });

  it('fails a refresh when no database is attached instead of scraping placeholder zeroes', async () => {
    const metrics = new AppMetricsService();
    await expect(metrics.refreshFinancialMetrics()).rejects.toThrow('Financial metrics require PrismaService');
  });
});
