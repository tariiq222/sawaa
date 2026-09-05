# Durable business notifications

This backend path covers booking-created staff notifications, cancellation notifications, appointment reminders, staff-created client welcome/staff notifications, and contact-message staff notifications. Auth/OTP, payment notifications, the general EventBus publisher and existing provider credential management keep their existing behavior.

PostgreSQL stores durable intent and per-target delivery. Redis/BullMQ schedules attempts. An empty queue does not prove that notifications were delivered.

## Controls

```dotenv
NOTIFICATION_OUTBOX_CAPTURE_ENABLED=false
NOTIFICATION_OUTBOX_DELIVERY_ENABLED=false
# A fixed, explicit ISO timestamp with timezone, agreed for the cutover:
NOTIFICATION_OUTBOX_CUTOVER_AT=
```

Both switches default to false. Enabling capture requires a valid cutover timestamp. Never set cutover to process startup time or advance it during restarts: doing so can exclude unprocessed sources. The configuration is loaded when the backend starts.

Capture determines whether newly eligible business events use the durable path. Delivery determines whether the new publisher/worker sends external messages. Existing intents retain ownership when capture is disabled; their source events must not fall back to legacy sending. Normal rollback pauses **delivery**, leaving capture on so the backlog remains durable.

## State meanings

| Delivery state | Operator meaning |
|---|---|
| READY / RETRY_WAIT | Persisted and due now/later; may need enqueue recovery. |
| SENDING | A worker holds a fenced lease and has recorded the attempt. |
| ACCEPTED | Provider accepted the request; recipient delivery/read is not proven. |
| DELIVERED | In-app row persisted or a supported provider receipt confirmed delivery. |
| SKIPPED | An explicit preference/target condition prevented sending. |
| EXPIRED | The message is no longer valid, including elapsed/rescheduled reminders. |
| DEAD | Permanent failure or exhausted safe retries; inspect reason before action. |
| UNKNOWN | Acceptance cannot be determined; never blindly retry. |

Five automatic provider attempts are allowed. Safe retries wait 30 seconds, 2 minutes, 5 minutes and 15 minutes plus jitter, respecting expiry and supported Retry-After. The current HTTP adapters discard Retry-After headers, so their proven HTTP 429 rejections use the scheduled backoff; the worker honors a retry delay only when the sender actually supplies it. Queue-add failures do not spend provider attempts. Each push token has its own state; failed tokens do not replay successful tokens.

Provider calls are outside database transactions. Lease expiry cannot retract a network request already sent. A timeout, lost provider response, or failure to persist the provider result can therefore leave UNKNOWN. Exactly-once external delivery is not promised. Existing adapters do not expose provider idempotency keys; do not infer duplicate protection from BullMQ job IDs or email Message-ID.

## Planned activation sequence

This document does not authorize deployment or production migrations.

1. Review the additive migrations and take the normal deployment backup. Apply migration files in order; do not edit previously applied migration SQL.
2. Deploy compatible code to all backend instances with capture and delivery disabled. Verify that no old binaries remain capable of consuming the scoped notification queues.
3. Quiesce the legacy appointment reminder scheduler and scoped producers/consumers for the transition, then drain their in-flight jobs. Record the final legacy reminder tick. Draining Redis alone does not produce durable delivery receipts for legacy work.
4. Choose a fixed cutover instant **after the end of the final legacy tick's five-minute lookahead window**. V2 reminder eligibility uses `dueAt = scheduledAt - reminderBeforeMinutes` and excludes dueAt before cutover. Keep reminder lead settings unchanged during this transition. Quiesce the other scoped business producers around the cutover so an event is not dispatched by both versions.
5. Enable capture with that same cutover on every instance, keeping delivery disabled initially. Verify intents/in-app notifications materialize and the eligible source backlog decreases. Work created while producers are quiesced must be resumed only after capture is enabled.
6. Enable delivery. Confirm progress and inspect UNKNOWN/DEAD before increasing workload. ACCEPTED is not confirmation that a person received a notification.

Never bulk-import old NotificationDeliveryLog rows as unsent messages: they do not store enough information to distinguish never-sent from accepted-but-unrecorded deliveries. No historical resend is automatic. Investigate historical gaps separately.

## Recovery and rollback

The Nest lifecycle reconciler runs at startup and on periodic ticks independently of Redis repeatable jobs. It scans allowlisted durable domain events (including PUBLISHED), missing intents, pending materialization, due deliveries, expired leases and existing SMS receipt rows. It does not republish general domain events or invoke payment consumers.

After Redis loss, restore Redis and allow the publisher to re-enqueue due database rows. Do not rewrite terminal database states or delete dedup records to force queue activity. A repeated/stale BullMQ job must no-op once the delivery is final or another worker owns it.

For rollback, set delivery false on all compatible instances and drain/stop currently active send workers. Keep capture true and keep cutover unchanged. Delivery already in progress may finish; no setting can unsend it. Preserve the additive schema and durable rows. Do not roll back to an old binary that lacks intent-ownership checks while scoped producers continue running.

UNKNOWN requires provider-side evidence or an explicit human decision accepting duplicate risk. Automatic recovery does not turn UNKNOWN into READY. Fix missing provider/template configuration before considering a safe DEAD retry. Retry actions must preserve attempt history and record operator/reason in the audit log; do not issue ad-hoc SQL that clears attempts or leases.

The operator handler accepts `{ deliveryId, actor, reason }`. It requeues only DEAD rows with a known-safe `NO_PROVIDER`, `TEMPLATE_UNAVAILABLE` or `SAFE_TRANSIENT` reason and fewer than five lifetime attempts. UNKNOWN, expired leases, invalid payloads and exhausted deliveries are rejected. The requeue and an ActivityLog SYSTEM record commit in one transaction. Correcting configuration does not reset the attempt counter. For `TEMPLATE_UNAVAILABLE` email only, the retry transaction loads the repaired active template and freezes the first valid subject/HTML from the intent, retaining the original destination. A still-missing template leaves the delivery DEAD; already-frozen valid content is not rendered again.

After inspecting the delivery and selecting the intended database environment, run from the repository root:

```sh
pnpm --filter=backend run notification-outbox:retry -- \
  --delivery-id <delivery-uuid> \
  --actor <operator-id> \
  --reason 'Configuration corrected; safe retry requested'
```

The command uses `DATABASE_URL`, instantiates only Prisma and the retry handler, and disconnects afterward. It does not start AppModule or send messages itself. Subsequent sending requires delivery to be enabled in the backend. Operator identity is an audit assertion by the trusted shell operator, not a new HTTP authentication mechanism.

## Monitoring and retention

Watch due count/oldest due age, enqueue failures, attempts/outcomes, UNKNOWN/DEAD, expired leases, last successful reconciler heartbeat and processing progress. Initial warning threshold is two minutes of due backlog without progress. Investigate UNKNOWN/DEAD when they appear. Redis queue counts complement these signals; they do not replace the database state.

Use bounded labels (channel, outcome, operation). Never put recipient IDs, phone numbers, tokens, payloads, credentials or raw provider error bodies in metric labels or error logs. Use delivery/intent IDs only in controlled diagnostic output.

Keep dedup tombstones after legacy Notification, NotificationDeliveryLog and SmsDelivery cleanup. Terminal payload retention is separate from identity retention; do not delete READY/RETRY_WAIT/SENDING/UNKNOWN work as a routine retention action. A 90-day terminal-payload horizon is the baseline. No destructive maintenance command is part of automatic rollout.

## Verification boundary

The notification-outbox real-infra suite must run on a named test-only PostgreSQL database and a separate Redis instance, with fake provider sending. The default backend E2E setup mocks BullMQ/ioredis and cannot by itself prove Redis-loss recovery. Run that existing lane separately for HTTP/API regression.

After applying the migrations to the dedicated test database, export `NOTIFICATION_OUTBOX_TEST_DATABASE_URL` and `NOTIFICATION_OUTBOX_TEST_REDIS_URL`, then run:

```sh
pnpm --filter=backend exec jest --config test/jest-notification-outbox.json --runInBand
```

The delivery suite rejects non-local hosts and database names without `test` or `e2e`. It removes only its own fixtures and jobs. The source suite creates minimal settings, a welcome template and a staff fixture when missing, then removes those fixtures; it does not run the application seed or configure providers. The Redis instance must be dedicated to this suite because the publisher scans eligible database deliveries.

Acceptance includes rollback atomicity; concurrent duplicate capture/materialization/claim; Redis job loss and stale generations; post-provider DB failure; expired leases and stale-owner fencing; per-token partial failure; receipts; reminder pagination beyond 200; cancellation/rescheduling/expiry; and cutover/paused ownership. Dashboard notification listing/read state continues to use the existing Notification table.

Passing local tests does not establish production delivery. Live provider receipt verification and operational activation are separate steps requiring the user's deployment authorization.
