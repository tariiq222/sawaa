import { Injectable } from '@nestjs/common';
import { Counter, Gauge } from 'prom-client';

import { AppMetricsService } from '../../../infrastructure/telemetry/app-metrics.service';

@Injectable()
export class NotificationOutboxMetrics {
  private readonly due: Gauge;
  private readonly oldestDueAge: Gauge;
  private readonly enqueueFailures: Counter;
  private readonly attempts: Counter;
  private readonly terminal: Counter;
  private readonly expiredLeases: Counter;
  private readonly reconciliation: Counter;
  private readonly heartbeat: Gauge;

  constructor(appMetrics: AppMetricsService) {
    const registers = [appMetrics.registry];
    this.due = new Gauge({
      name: 'notification_outbox_due',
      help: 'Current notification deliveries due for enqueue',
      registers,
    });
    this.oldestDueAge = new Gauge({
      name: 'notification_outbox_oldest_due_age_seconds',
      help: 'Age in seconds of the oldest due notification delivery',
      registers,
    });
    this.enqueueFailures = new Counter({
      name: 'notification_outbox_enqueue_failures_total',
      help: 'Notification delivery queue enqueue failures',
      registers,
    });
    this.attempts = new Counter({
      name: 'notification_outbox_attempts_total',
      help: 'Notification provider attempts by channel and bounded outcome',
      labelNames: ['channel', 'outcome'] as const,
      registers,
    });
    this.terminal = new Counter({
      name: 'notification_outbox_terminal_total',
      help: 'Notification deliveries entering UNKNOWN or DEAD',
      labelNames: ['status'] as const,
      registers,
    });
    this.expiredLeases = new Counter({
      name: 'notification_outbox_expired_leases_total',
      help: 'Expired notification delivery leases fenced as unknown',
      registers,
    });
    this.reconciliation = new Counter({
      name: 'notification_outbox_reconciliation_total',
      help: 'Notification outbox reconciliation runs by component and result',
      labelNames: ['component', 'result'] as const,
      registers,
    });
    this.heartbeat = new Gauge({
      name: 'notification_outbox_last_successful_heartbeat_seconds',
      help: 'Unix timestamp of the last successful notification outbox lifecycle tick',
      registers,
    });
  }

  setBacklog(due: number, oldestAgeSeconds: number): void {
    this.due.set(due);
    this.oldestDueAge.set(oldestAgeSeconds);
  }

  recordEnqueueFailure(): void {
    this.enqueueFailures.inc();
  }

  recordAttempt(channel: string, outcome: string): void {
    this.attempts.inc({ channel, outcome });
  }

  recordTerminal(status: 'UNKNOWN' | 'DEAD'): void {
    this.terminal.inc({ status });
  }

  recordExpiredLease(): void {
    this.expiredLeases.inc();
  }

  recordReconciliation(component: string, result: 'success' | 'failure'): void {
    this.reconciliation.inc({ component, result });
  }

  setLastSuccessfulHeartbeat(timestampSeconds: number): void {
    this.heartbeat.set(timestampSeconds);
  }
}
