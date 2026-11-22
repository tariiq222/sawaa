import type { Prisma } from '@prisma/client';

/**
 * Neutral capture contract for the notification outbox (MNT-19).
 *
 * `people` (client creation) captures durable notification intents. Importing
 * the comms implementation file directly made `comms -> people -> comms` a
 * bidirectional module pair, so the *contract* lives here in `common` while the
 * implementation stays in comms — the same pattern as `CLIENT_ACCOUNT_STORE`:
 * consumers depend on the shape, not on the module that produces it.
 *
 * The consumer keys below intentionally restate the string values owned by
 * `notification-outbox.types.ts`. They are part of the persisted outbox row
 * (`consumerKey`), so changing one without the other would orphan queued rows;
 * `capture.contract.spec.ts` pins them against the comms constants.
 */
export const NOTIFICATION_INTENT_CAPTURE = Symbol('NOTIFICATION_INTENT_CAPTURE');

export const NOTIFICATION_CAPTURE_POLICY = Symbol('NOTIFICATION_CAPTURE_POLICY');

/** Payload-version constant shared by every capture call site. */
export const NOTIFICATION_INTENT_PAYLOAD_VERSION = 1 as const;

export interface CaptureNotificationIntentCommand {
  sourceKey: string;
  consumerKey: string;
  sourceOutboxId?: string;
  payloadVersion: typeof NOTIFICATION_INTENT_PAYLOAD_VERSION;
  payload: unknown;
  occurredAt: Date;
  expiresAt?: Date;
}

/**
 * The port a cluster injects to capture an intent inside its own transaction.
 * Implemented by comms and provided through `NotificationOutboxCaptureModule`.
 */
export interface NotificationIntentCapturePort {
  execute(
    command: CaptureNotificationIntentCommand,
    tx?: Prisma.TransactionClient,
  ): Promise<string>;
}

/** Whether capture is enabled for the current rollout. */
export interface NotificationCapturePolicy {
  shouldCapture(at: Date): boolean;
}

/**
 * Stable source keys. A source module names its own outbox rows here instead of
 * importing the comms implementation.
 */
export const notificationSourceKey = {
  clientEnrolled(clientId: string): string {
    return `client-enrolled:${clientId}`;
  },
} as const;

/** The two intents client creation captures. */
export const CLIENT_ENROLLED_CONSUMERS = {
  CLIENT: 'comms.client-enrolled-client.v2',
  STAFF: 'comms.client-enrolled-staff.v2',
} as const;
