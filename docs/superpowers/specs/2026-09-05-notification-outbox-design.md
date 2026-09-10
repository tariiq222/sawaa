# Durable non-payment notifications

Approved by the user on 2026-09-05 after a read-only backend audit. This document records the approved chat design. No commit, push, merge, deployment, production DB mutation, Auth, Payments, or Mobile changes are authorized.

## Outcome and boundary

PostgreSQL is the recoverable source of truth for notification intent and delivery. BullMQ schedules work and may lose/replay jobs without losing intent. External delivery is NOT exactly once: an ambiguous provider outcome is UNKNOWN and must not automatically resend without verified provider idempotency or status reconciliation. Existing provider interfaces expose no idempotency key; do not assume it exists.

Only business notifications for booking created/cancelled/reminder, staff-created client welcome/enrolled staff, and contact-message staff fanout are migrated. Keep shared SendNotificationHandler, ResilientNotificationDispatcher, SendEmailHandler/queue, SendSmsHandler, SendPushHandler, notification-channel (OTP), all payment handlers and the general EventBus/outbox publisher unchanged. Add a dedicated v2 notification path reusing existing provider factories without modifying credentials, encryption, guards, CLS semantics, role sets, or HTTP DTOs. The existing nonpayment event consumers may be redirected to v2 only after cutover; their pre-cutover behavior stays intact.

## Durable schema

Add in comms.prisma via an additive migration:

* NotificationIntent: id, sourceKey, consumerKey, sourceOutboxId optional, payloadVersion, payload JSON, payloadHash, status PENDING/MATERIALIZED/RETRY_WAIT/DEAD/EXPIRED, attempts, nextAttemptAt, expiresAt optional, leaseToken/leaseUntil, timestamps. Unique(sourceKey, consumerKey).
* NotificationDelivery: id, intentId FK, recipientType/id, channel, non-null targetKey, notificationId optional, deliveryLogId optional unique, immutable channel payload, status READY/SENDING/RETRY_WAIT/ACCEPTED/DELIVERED/SKIPPED/EXPIRED/DEAD/UNKNOWN, attempts, nextAttemptAt, nextEnqueueAt, enqueueGeneration, leaseToken/leaseUntil, providerName/messageId, acceptedAt/deliveredAt, safe outcome reason, timestamps. Unique(intentId, recipientType, recipientId, channel, targetKey). A push token has its own row; in-app uses a fixed targetKey. Optional references to legacy audit rows must not break existing retention deletes; use SetNull or scalar references and retain independent tombstone keys.
* NotificationDeliveryAttempt: id, deliveryId FK, attemptNumber, leaseToken, startedAt/finishedAt, outcome, providerMessageId, sanitized errorCode. Unique(deliveryId, attemptNumber).

Due/expired-lease/next-enqueue indexes are bounded status+timestamp+id indexes; provider receipt lookup uses providerName+providerMessageId. No organizationId in new tables. Payload stores only replay-required information, no provider secrets. Redis stores identifiers only. Freeze content and recipient/target snapshot on materialization; recheck current delivery eligibility before sending without expanding audience.

## Capture and materialize

For existing booking OutboxEvent rows, both the event consumer and a read-only source reconciler create the same intent using the envelope eventId (source row id can differ) plus stable consumerKey. Scanner covers PUBLISHED as well as pending rows, filters an explicit allowlist, and never republishes the domain event. Page missing intents with NOT EXISTS and keyset/bounded processing; do not permanently advance past uncommitted/out-of-order rows. Initial cutover timestamp bounds history; reject unsupported payload versions, don't replay historical notifications automatically.

Staff client creation and contact-message creation persist their intents in the SAME Prisma transaction as the new business record. Keep phone/email dedup and existing return shapes. Do not modify identity/auth callsites. Any nonnotification domain event compatibility must be preserved without making Redis a requirement for committed success.

Reminders capture due confirmed bookings until scheduledAt, not a single five-minute slice. Page beyond 200 with durable uniqueness keyed by bookingId+scheduledAt+policyVersion. Recheck status and scheduledAt before materialization/send. Expire cancelled/rescheduled/elapsed reminders. Keep the current recipient roles, targeting preferences and safe lock-screen text; do not add clinical detail.

Materialize one intent in a short transaction: lock/check intent, determine a stable audience, create one legacy Notification per recipient and all channel delivery rows, mark intent MATERIALIZED. Rollback all on failure; replay sees the prior result. Source key with different payloadHash is a conflict, not an overwrite. Resolve current booking contact fields where event payload lacks them. A deliberately empty audience is recorded, not silently errored.

## Delivery, scheduling, and locking

Publisher atomically claims due rows using a CTE SELECT FOR UPDATE SKIP LOCKED + UPDATE RETURNING (or one Prisma transaction), sets nextEnqueueAt and increments enqueueGeneration, then calls queue.add outside DB transaction. Job name notification-delivery; ID deliveryId-generation; data IDs only; attempts:1. Enqueue errors do not consume provider attempts; due rows are recoverable if add succeeds but acknowledgement is lost.

Worker atomically checks ready/retry state and due time, acquires a unique lease, increments attempt count and inserts attempt BEFORE calling provider. Use 60s lease, renew every 15s while active; compare token for every outcome update. Provider calls outside DB transaction; a timeout/connection reset after possible acceptance is UNKNOWN, not retryable. Expired SENDING is UNKNOWN. An older worker may never overwrite a newer state. A queued duplicate must no-op on terminal/active/ineligible rows. Reject stale generations when appropriate.

Five provider attempts total, delays 30s/2m/5m/15m with jitter and Retry-After; expiry wins. Only known safe transient failures retry. Invalid recipient/template/config produces an explicit permanent/config failure, never SENT. Intentionally disabled preference/missing optional target is SKIPPED. External success is ACCEPTED; in-app creation is DELIVERED. DLR receipt can advance SMS to DELIVERED or terminal failure by reading existing SmsDelivery; never change webhook verification. Record SmsDelivery for new SMS provider calls so existing DLR has its target. Ambiguous outcome remains inspectable; automatic provider lookup only if actually supported.

Nest lifecycle background service runs startup recovery and bounded periodic reconciliation independent of BullMQ repeatable jobs. Do not register a Redis-only reconciler. Avoid overlapping local ticks; DB row claims provide multi-instance correctness. Shutdown clears timers and awaits tracked work as practical. Use existing context APIs without editing their security behavior.

## Operations and rollout

Capture and delivery controls are distinct. Default disabled to preserve production behavior until explicit operational rollout. Explicit cutover timestamp stable across restarts; no boot-time now() that loses backlog. Deploy compatible disabled path everywhere; drain old scoped consumers; set cutoff and capture, then delivery. After capture is on, rollback pauses delivery while capture continues; no fallback legacy send for rows already owned by v2.

Metrics use existing registry infrastructure but notification-specific fields/components; bounded labels only. Expose due count and oldest age, enqueue failures, attempts/results, UNKNOWN/DEAD, expired leases, reconciliation progress/last successful heartbeat. No phone/token/payload in logs. Initial warning after two minutes of due backlog without progress; UNKNOWN/DEAD alert. A scoped operator script (no new endpoint/guard) may requeue known-safe DEAD rows with an audit record, preserving lifetime attempt history and never retrying UNKNOWN automatically. No external sending during tests.

Retention keeps source/delivery dedup tombstones independent of legacy audit cleanup. Payload can be redacted after terminal retention (90 days baseline), but pending and UNKNOWN rows must not silently disappear. No destructive maintenance run without explicit authorization.

## Required acceptance

Unit tests for classifications, source keys/hash conflicts, timing, target eligibility, retry/exhaustion, unknown outcomes, terminal duplicate no-op, module wiring, and cutover/paused behavior. Real PostgreSQL+Redis tests for transaction rollback, duplicate materialization/claim races, job loss/recovery, post-provider DB failure, expired leases/stale owners, multi-token partial failure, receipt reconciliation, >200 reminder backlog and reschedule/cancel/expiry. Providers fake/injected only. Run relevant legacy tests, backend typecheck/build, lint scoped changed files, additive migration validation, backend regression suite as appropriate, and dashboard smoke for affected flows. Distinguish unit proof, real infra proof, and production verification; never claim production delivery.
