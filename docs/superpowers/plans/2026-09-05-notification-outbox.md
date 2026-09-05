# Notification Outbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Project delegation/testing rules and direct user authorization take precedence over skill defaults.

**Goal:** Recover nonpayment backend notifications from PostgreSQL despite Redis loss and worker crashes.

**Architecture:** An additive intent/delivery/attempt ledger, dedicated BullMQ worker, and Nest lifecycle reconciler. Existing general event bus and Auth/Payments send paths stay unchanged.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, BullMQ 5, Jest.

**Spec:** `docs/superpowers/specs/2026-09-05-notification-outbox-design.md`

## Global Constraints

- Work only in `/Users/tariq/code/sawaa/.worktrees/notification-outbox` on `codex/notification-outbox`; main checkout and other agents' work are not yours.
- Backend only, plus this plan/spec and backend operations documentation. No Auth, Payments, Mobile or provider credential/encryption changes. No shared endpoint/DTO changes.
- No commit, push, merge, deployment, destructive database actions, or existing migration edits.
- Sol owns schema/contracts/integration and is the technical lead; at most two Luna workers can run alongside root+Sol within the four-agent limit.
- Workers are not alone: never revert others' edits. Cross-package contracts must be written once before dispatch, passed via local file URIs. No nested worker delegation.
- Workers write tests before implementation; coordinator runs required RED checks and final gates. Workers must not run build, lint, or full suites. No live providers.

## Task 1: Freeze schema and package contracts (Sol lead; prerequisite)

Files: `apps/backend/prisma/schema/comms.prisma`, new `apps/backend/prisma/migrations/*_notification_outbox/migration.sql`, `apps/backend/src/modules/comms/notification-outbox/notification-outbox.types.ts`, `notification-outbox.config.ts`; contract brief under this plan's `.superpowers/sdd/` workspace.

- [x] Inspect Prisma transaction/context patterns and existing module injection conventions.
- [x] Write behavioral test expectations for unique source keys, retry/outcome policies and disabled/cutover controls, and provide root the narrow RED command.
- [x] Define the three models from the spec and concrete typed payload variants for booking-created-staff, booking-cancelled client/staff, reminder, enrolled client/staff, contact staff.
- [x] Publish a single shared batch contract with class signatures, constructor dependencies, DTO shapes, schema enum names, lease/queue constants, per-worker file ownership, and acceptance. Example stable boundary:

```ts
// Lead must freeze exact names before dispatch, and keep tests aligned.
capture.execute(command: CaptureNotificationIntent, tx?: Prisma.TransactionClient): Promise<string>;
materialize.execute(intentId: string): Promise<void>;
deliveryWorker.process(deliveryId: string, generation: number): Promise<void>;
publisher.execute(): Promise<void>;
reconciler.execute(): Promise<void>;
```

## Task 2: Capture, source recovery, and materialization (Luna A)

Files owned: new capture/materialize/source reconciliation helpers and colocated specs in `notification-outbox/`; scoped nonpayment `comms/events/on-booking-*.handler.ts`, `on-client-enrolled*.handler.ts`, `comms/contact-messages/create-contact-message.handler.ts`, `people/clients/create-client.handler.ts` and their specs. Do not edit shared send handlers or module wiring. Reminder v2 source logic is new; legacy reminder cron branching/wiring belongs to Sol.

Consumes: frozen models/config/payload contracts. Produces capture/materialize/source sweep interfaces for coordinator/runtime.

- [x] Write rollback/replay/hash conflict tests before code; request root RED execution.
- [x] Implement atomic capture with optional transaction and atomic audience/in-app/channel materialization. A repeated key with identical payload returns existing intent, not a duplicate.
- [x] Implement read-only OutboxEvent allowlist recovery, using envelope eventId and covering published rows, and reminder pagination/expiry/reschedule protection.
- [x] Add transactional capture to client/contact business sources and gated v2 event routing; keep pre-cutover path and staff role sets.
- [x] Provide report with changed files, behavioral evidence, source coverage and any unresolved constraints.

## Task 3: Delivery, publication, and runtime reconciliation (Luna B)

Files owned: new publisher/worker/channel sender/lease/retry/reconciliation helpers and colocated specs in `notification-outbox/`. Do not edit shared factories/handlers, models/types/config or module wiring.

Consumes: frozen models/config/types; new sender uses existing factories and FcmService, preserving HTML escaping. Produces publisher, worker, delivery recovery and lifecycle-compatible tick methods.

- [x] Write duplicate-claim, retry/UNKNOWN, expiry and no-provider success tests before code; request root RED execution.
- [x] Implement atomic claims with attempt insertion and fenced result writes; no provider calls in transactions, retry only safe failures, unknown outcomes never blind resend.
- [x] Implement payload-free BullMQ jobs, recoverable enqueue generations and isolated per-token deliveries.
- [x] Add provider receipt/audit recording, SMS DLR read reconciliation, sanitized result metrics/hooks and heartbeat/lease expiry recovery.
- [x] Provide report with precise lease/retry semantics and integration test cases needed.

## Task 4: Integrate, verify, and document (Sol lead with root support)

Files owned: new notification-outbox module/lifecycle/metrics/operator command; `comms.module.ts`; scoped reminder cron gating; `.env.example` backend controls; `apps/backend/test/notification-outbox*.e2e-spec.ts` and test helpers; backend runbook. Root owns independent environment preparation and read-only acceptance review unless file ownership is explicitly reassigned.

- [x] Review each worker's spec compliance and code quality, resolve cross-package issues before gates.
- [x] Wire dedicated module/context lifecycle without circular providers or shared auth/payment behavior changes.
- [x] Add operator retry path for safe DEAD outcomes with append-only audit and no UNKNOWN override; document paused delivery, cutover and retention/tombstones.
- [x] Execute real infra tests using a newly created, clearly test-only database and isolated Redis instance. Do not touch existing databases or run external providers. Root provisions and passes connection locations privately through local file.
- [x] Run relevant backend tests, typecheck, scoped lint, build and additive migration/schema checks. Dashboard smoke after test backend preparation; document exact blocker if unavailable rather than fabricate proof.
- [x] Request independent final review using changed-file/diff package, fix findings and rerun impacted checks only.
- [x] Leave uncommitted changes in the worktree and report evidence, remaining operational activation, and exact paths. Do not merge or delete worktree.

## Verification examples

```ts
// PostgreSQL rollback and durable recovery expectations, using real services:
expect(await prisma.notificationIntent.count({ where: { sourceKey } })).toBe(0); // after thrown business transaction
expect(await prisma.notificationIntent.count({ where: { sourceKey } })).toBe(1); // after concurrent duplicate capture
expect(await prisma.notification.count({ where: { recipientId } })).toBe(1); // after repeated materialization
expect((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id } })).status).toBe('UNKNOWN'); // after accepted send + lost DB outcome
expect(providerCalls).toHaveLength(1); // duplicate job / stale owner / unknown recovery must not blindly resend
```

## Execution record

- User approved the complete design with `yes` on 2026-09-05.
- Isolated worktree created from `703e9444`; unrelated untracked safe-improvement docs remain untouched in main checkout.
- No additional user approval is needed for local implementation, new migration file, or disposable local verification infrastructure. Applying migrations to production is not authorized.
