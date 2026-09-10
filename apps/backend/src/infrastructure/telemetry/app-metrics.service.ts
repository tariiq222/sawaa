import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';
import { PrismaService } from '../database';

const HTTP_LABELS = ['method', 'route', 'status_class'] as const;

/**
 * Financial event names currently emitted by the application. Keeping this
 * list closed is deliberate: event names come from database rows, so using a
 * raw eventType as a Prometheus label would allow unbounded cardinality.
 */
export const FINANCIAL_EVENT_TYPES = [
  'finance.payment.completed',
  'finance.payment.failed',
  'finance.payment.deposit_paid',
  'finance.refund.completed',
  'finance.invoice.receipt.issued',
  'bookings.booking.cancelled',
  'bookings.booking.cancel_approved',
  'bookings.booking.confirmed',
] as const;

export type FinancialEventType = (typeof FINANCIAL_EVENT_TYPES)[number];
export type FinancialOutboxStatus = 'pending' | 'failed';

export interface FinancialOutboxAggregate {
  eventType: FinancialEventType | string;
  status: FinancialOutboxStatus | string;
  count: number;
  /** Oldest pending row age, in seconds, from an aggregate query. */
  oldestAgeSeconds?: number;
}

/**
 * Aggregate-only input for the financial gauges. Callers must provide counts
 * and ages from SQL/Prisma aggregate queries; this type intentionally has no
 * row-shaped or identifier-bearing fields.
 */
export interface FinancialMetricsSnapshot {
  outbox: readonly FinancialOutboxAggregate[];
  refundExceedsSettledInvoices: number;
  overcollectedInvoices: number;
  providerUnknown: number;
  refundManualReviews: number;
}

const UNKNOWN_LABEL = 'unknown';
const FINANCIAL_REFRESH_TTL_MS = 30_000;

function boundedLabel<T extends readonly string[]>(value: unknown, allowed: T): T[number] | typeof UNKNOWN_LABEL {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : UNKNOWN_LABEL;
}

function boundedCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function boundedAge(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

@Injectable()
export class AppMetricsService {
  readonly registry = new Registry();
  private lastFinancialRefreshAt = 0;
  private financialRefresh: Promise<FinancialMetricsSnapshot> | undefined;
  private lastFinancialSnapshot: FinancialMetricsSnapshot | undefined;

  constructor(@Optional() private readonly prisma?: PrismaService) {
    // Keep process/runtime metrics on the same registry as application metrics
    // so the existing scrape endpoint exposes one complete process view.
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'sawaa_',
    });
  }

  readonly httpRequests = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests by method, route template, and status class',
    labelNames: HTTP_LABELS,
    registers: [this.registry],
  });

  readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds by method, route template, and status class',
    labelNames: HTTP_LABELS,
    registers: [this.registry],
  });

  /**
   * The in-flight series uses the bounded `in_flight` status marker because a
   * response status is not known when a request starts.
   */
  readonly httpRequestsInFlight = new Gauge({
    name: 'http_requests_in_flight',
    help: 'Current HTTP requests in flight by method and route template',
    labelNames: HTTP_LABELS,
    registers: [this.registry],
  });

  readonly httpErrors = new Counter({
    name: 'http_errors_total',
    help: 'Total HTTP error responses by status class',
    labelNames: ['status_class'] as const,
    registers: [this.registry],
  });

  readonly paymentAttempts = new Counter({
    name: 'payment_attempt_total',
    help: 'Total Moyasar payment webhook events by result',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });

  readonly auditLogFailures = new Counter({
    name: 'audit_log_failures_total',
    help: 'Total ActivityLog write failures (silent audit-trail gaps)',
    labelNames: ['phase'] as const,
    registers: [this.registry],
  });

  readonly outboxTerminalFailures = new Counter({
    name: 'outbox_terminal_failures_total',
    help: 'Total outbox events that reached the terminal FAILED state',
    labelNames: ['event_type'] as const,
    registers: [this.registry],
  });

  /** Current financial outbox rows by closed event/status labels. */
  readonly financialOutboxEvents = new Gauge({
    name: 'financial_outbox_events',
    help: 'Current financial outbox rows by bounded event type and status',
    labelNames: ['event_type', 'status'] as const,
    registers: [this.registry],
  });

  /** Age of the oldest pending financial outbox row for each bounded series. */
  readonly financialOutboxOldestPendingAgeSeconds = new Gauge({
    name: 'financial_outbox_oldest_pending_age_seconds',
    help: 'Age in seconds of the oldest pending financial outbox row',
    labelNames: ['event_type'] as const,
    registers: [this.registry],
  });

  readonly financialRefundExceedsSettledInvoices = new Gauge({
    name: 'financial_refund_exceeds_settled_invoices',
    help: 'Invoices where completed refunds exceed gross settled payments',
    registers: [this.registry],
  });

  readonly financialOvercollectedInvoices = new Gauge({
    name: 'financial_overcollected_invoices',
    help: 'Invoices where net settled payments exceed the invoice total',
    registers: [this.registry],
  });

  readonly financialProviderUnknown = new Gauge({
    name: 'financial_provider_unknown',
    help: 'Current count of financial provider states that are unknown',
    registers: [this.registry],
  });

  readonly financialRefundManualReviews = new Gauge({
    name: 'financial_refund_manual_reviews',
    help: 'Current count of refunds in the explicit MANUAL_REVIEW state',
    registers: [this.registry],
  });

  /**
   * Publish a snapshot produced by bounded aggregate queries. Resetting the
   * gauges first prevents a series that disappeared from the database from
   * remaining visible after the next refresh.
   */
  recordFinancialMetrics(snapshot: FinancialMetricsSnapshot): void {
    this.financialOutboxEvents.reset();
    this.financialOutboxOldestPendingAgeSeconds.reset();

    const combined = new Map<string, { eventType: string; status: string; count: number; oldestAgeSeconds: number }>();
    for (const aggregate of snapshot.outbox) {
      const eventType = boundedLabel(aggregate.eventType, FINANCIAL_EVENT_TYPES);
      const status = aggregate.status === 'pending' || aggregate.status === 'failed'
        ? aggregate.status
        : UNKNOWN_LABEL;
      const safeEventType = eventType;
      const safeStatus = status;
      const key = `${safeEventType}\u0000${safeStatus}`;
      const prior = combined.get(key) ?? { eventType: safeEventType, status: safeStatus, count: 0, oldestAgeSeconds: 0 };
      prior.count += boundedCount(aggregate.count);
      prior.oldestAgeSeconds = Math.max(prior.oldestAgeSeconds, boundedAge(aggregate.oldestAgeSeconds));
      combined.set(key, prior);
    }
    for (const aggregate of combined.values()) {
      this.financialOutboxEvents
        .labels({ event_type: aggregate.eventType, status: aggregate.status })
        .set(aggregate.count);
      if (aggregate.status === 'pending') {
        this.financialOutboxOldestPendingAgeSeconds
          .labels({ event_type: aggregate.eventType })
          .set(aggregate.oldestAgeSeconds);
      }
    }

    this.financialRefundExceedsSettledInvoices.set(boundedCount(snapshot.refundExceedsSettledInvoices));
    this.financialOvercollectedInvoices.set(boundedCount(snapshot.overcollectedInvoices));
    this.financialProviderUnknown.set(boundedCount(snapshot.providerUnknown));
    this.financialRefundManualReviews.set(boundedCount(snapshot.refundManualReviews));
  }

  /**
   * Refresh from a caller-owned aggregate provider. The provider is invoked
   * once per refresh; no per-row data is accepted or loaded by this service.
   */
  async collectFinancialMetrics(
    aggregateProvider: () => Promise<FinancialMetricsSnapshot>,
  ): Promise<void> {
    this.recordFinancialMetrics(await aggregateProvider());
  }

  /**
   * Refresh persisted financial gauges before an authorized scrape. At most one
   * refresh runs per process every 30 seconds; concurrent scrapes share it.
   */
  async refreshFinancialMetrics(force = false): Promise<FinancialMetricsSnapshot> {
    if (!this.prisma) throw new Error('Financial metrics require PrismaService');
    if (!force && this.lastFinancialSnapshot && Date.now() - this.lastFinancialRefreshAt < FINANCIAL_REFRESH_TTL_MS) {
      return this.lastFinancialSnapshot;
    }
    if (this.financialRefresh) return this.financialRefresh;
    this.financialRefresh = this.queryFinancialMetrics().then((snapshot) => {
      this.recordFinancialMetrics(snapshot);
      this.lastFinancialSnapshot = snapshot;
      this.lastFinancialRefreshAt = Date.now();
      return snapshot;
    }).finally(() => {
      this.financialRefresh = undefined;
    });
    return this.financialRefresh;
  }

  private async queryFinancialMetrics(): Promise<FinancialMetricsSnapshot> {
    const prisma = this.prisma!;
    const allowedTypes = Prisma.join(FINANCIAL_EVENT_TYPES);
    const [outbox, balances, refunds] = await Promise.all([
      prisma.$queryRaw<Array<{ eventType: string; status: string; count: number; oldestAgeSeconds: number }>>(Prisma.sql`
        SELECT CASE WHEN "eventType" IN (${allowedTypes}) THEN "eventType" ELSE 'unknown' END AS "eventType",
          LOWER("status") AS "status", COUNT(*)::int AS "count",
          CASE WHEN LOWER("status") = 'pending'
            THEN GREATEST(EXTRACT(EPOCH FROM NOW() - MIN("createdAt")), 0)::float8
            ELSE 0::float8
          END AS "oldestAgeSeconds"
        FROM "OutboxEvent"
        WHERE "status" IN ('PENDING', 'FAILED')
        GROUP BY 1, 2
      `),
      prisma.$queryRaw<Array<{ refundExceedsSettledInvoices: number; overcollectedInvoices: number }>>(Prisma.sql`
        WITH settled AS (
          SELECT "invoiceId", SUM("amount") AS gross
          FROM "Payment"
          WHERE "status" IN ('COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED')
          GROUP BY "invoiceId"
        ), completed_refunds AS (
          SELECT "invoiceId", SUM("amount") AS refunded
          FROM "RefundRequest"
          WHERE "status" = 'COMPLETED'
          GROUP BY "invoiceId"
        )
        SELECT (COUNT(*) FILTER (WHERE COALESCE(r.refunded, 0) > COALESCE(s.gross, 0)))::int AS "refundExceedsSettledInvoices",
          (COUNT(*) FILTER (WHERE COALESCE(s.gross, 0) - COALESCE(r.refunded, 0) > i."total"))::int AS "overcollectedInvoices"
        FROM "Invoice" i
        LEFT JOIN settled s ON s."invoiceId" = i."id"
        LEFT JOIN completed_refunds r ON r."invoiceId" = i."id"
        WHERE s."invoiceId" IS NOT NULL OR r."invoiceId" IS NOT NULL
      `),
      prisma.$queryRaw<Array<{ providerUnknown: number; refundManualReviews: number }>>(Prisma.sql`
        SELECT (COUNT(*) FILTER (WHERE "providerState" = 'CALL_UNKNOWN'))::int AS "providerUnknown",
          (COUNT(*) FILTER (WHERE "status" = 'MANUAL_REVIEW'))::int AS "refundManualReviews"
        FROM "RefundRequest"
      `),
    ]);
    return {
      outbox,
      refundExceedsSettledInvoices: Number(balances[0]?.refundExceedsSettledInvoices ?? 0),
      overcollectedInvoices: Number(balances[0]?.overcollectedInvoices ?? 0),
      providerUnknown: Number(refunds[0]?.providerUnknown ?? 0),
      refundManualReviews: Number(refunds[0]?.refundManualReviews ?? 0),
    };
  }
}
