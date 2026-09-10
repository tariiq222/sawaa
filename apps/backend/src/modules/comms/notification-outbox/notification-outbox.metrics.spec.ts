import { Registry } from 'prom-client';

import { NotificationOutboxMetrics } from './notification-outbox.metrics';

describe('NotificationOutboxMetrics', () => {
  it('publishes backlog, outcomes, lease recovery, and heartbeat with bounded labels', async () => {
    const registry = new Registry();
    const metrics = new NotificationOutboxMetrics({ registry } as never);

    metrics.setBacklog(7, 125);
    metrics.recordEnqueueFailure();
    metrics.recordAttempt('SMS', 'UNKNOWN');
    metrics.recordTerminal('UNKNOWN');
    metrics.recordExpiredLease();
    metrics.recordReconciliation('deliveries', 'success');
    metrics.setLastSuccessfulHeartbeat(1_789_000_000);

    const text = await registry.metrics();
    expect(text).toContain('notification_outbox_due 7');
    expect(text).toContain('notification_outbox_oldest_due_age_seconds 125');
    expect(text).toContain('notification_outbox_enqueue_failures_total 1');
    expect(text).toContain('notification_outbox_attempts_total{channel="SMS",outcome="UNKNOWN"} 1');
    expect(text).toContain('notification_outbox_terminal_total{status="UNKNOWN"} 1');
    expect(text).toContain('notification_outbox_expired_leases_total 1');
    expect(text).toContain('notification_outbox_reconciliation_total{component="deliveries",result="success"} 1');
    expect(text).toContain('notification_outbox_last_successful_heartbeat_seconds 1789000000');
    expect(text).not.toContain('phone');
    expect(text).not.toContain('token');
    expect(text).not.toContain('payload');
  });
});
