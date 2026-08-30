import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

const HTTP_LABELS = ['method', 'route', 'status_class'] as const;

@Injectable()
export class AppMetricsService {
  readonly registry = new Registry();

  constructor() {
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
}
