import { Injectable } from '@nestjs/common';
import { Counter, Registry } from 'prom-client';

@Injectable()
export class AppMetricsService {
  readonly registry = new Registry();

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
}
