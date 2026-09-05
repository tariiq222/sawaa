import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../infrastructure/database';
import { CaptureNotificationIntentHandler, hashPayload } from './capture-notification-intent.handler';
import { NotificationOutboxConfig } from './notification-outbox.config';
import {
  NOTIFICATION_OUTBOX_CONSUMERS,
  NOTIFICATION_OUTBOX_PAYLOAD_VERSION,
  type NotificationOutboxConsumerKey,
  type NotificationOutboxTickResult,
  notificationSourceKey,
} from './notification-outbox.types';
import { isValidNotificationIntentPayload } from './notification-payload-validation';

const PAGE_SIZE = 100;
type SourceRow = {
  id: string;
  eventType: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
};
type Envelope = {
  eventId?: string;
  version?: number;
  occurredAt?: Date | string;
  payload?: Record<string, unknown>;
};

@Injectable()
export class ReconcileNotificationSourcesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capture: CaptureNotificationIntentHandler,
    private readonly config: NotificationOutboxConfig,
  ) {}

  async execute(): Promise<NotificationOutboxTickResult> {
    if (!this.config.captureEnabled || !this.config.cutoverAt) {
      return { examined: 0, changed: 0, failed: 0 };
    }
    let examined = 0;
    let changed = 0;
    let failed = 0;
    let cursor: string | null = null;
    for (;;) {
      // Query only source rows that still lack one or more expected consumer
      // receipts. This avoids rescanning the historical outbox every tick,
      // while keyset paging and the unique intent key make crash recovery safe.
      const rows: SourceRow[] = await this.prisma.$queryRaw<SourceRow[]>(Prisma.sql`
        SELECT oe."id", oe."eventType", oe."payload", oe."createdAt"
        FROM "OutboxEvent" oe
        WHERE oe."eventType" IN (
          'bookings.booking.created',
          'bookings.booking.cancelled',
          'people.client.enrolled'
        )
          AND oe."status" IN ('PENDING', 'PUBLISHED')
          AND oe."createdAt" >= ${this.config.cutoverAt}
          AND (${cursor}::uuid IS NULL OR oe."id" > ${cursor}::uuid)
          AND (
            SELECT COUNT(*)::int
            FROM "NotificationIntent" ni
            WHERE ni."sourceOutboxId" = oe."id"
          ) < CASE WHEN oe."eventType" = 'bookings.booking.created' THEN 1 ELSE 2 END
        ORDER BY oe."id" ASC
        LIMIT ${PAGE_SIZE}
      `);
      if (rows.length === 0) break;
      for (const row of rows) {
        cursor = row.id;
        examined += 1;
        try {
          const envelope = row.payload as unknown as Envelope;
          const occurredAt = new Date(envelope.occurredAt ?? Number.NaN);
          if (
            !envelope.eventId ||
            envelope.version !== NOTIFICATION_OUTBOX_PAYLOAD_VERSION ||
            !envelope.payload ||
            Number.isNaN(occurredAt.getTime())
          ) {
            changed += await this.recordUnsupported(row, envelope);
            continue;
          }
          if (!this.config.shouldCapture(occurredAt)) continue;
          const commands = this.commandsFor(row.eventType, envelope as Required<Envelope>);
          if (commands.some((command) => !isValidNotificationIntentPayload(command.consumerKey, command.payload))) {
            changed += await this.recordUnsupported(row, envelope);
            continue;
          }
          for (const command of commands) {
            const existing = await this.prisma.notificationIntent.findUnique({
              where: {
                sourceKey_consumerKey: {
                  sourceKey: command.sourceKey,
                  consumerKey: command.consumerKey,
                },
              },
              select: { id: true },
            });
            await this.capture.execute({ ...command, sourceOutboxId: row.id });
            if (!existing) changed += 1;
          }
        } catch {
          failed += 1;
        }
      }
      if (rows.length < PAGE_SIZE) break;
    }
    return { examined, changed, failed };
  }

  private async recordUnsupported(row: SourceRow, envelope: Envelope): Promise<number> {
    const consumers = this.consumersFor(row.eventType);
    const payload = {
      kind: 'unsupported-notification-source',
      reason: 'INVALID_PAYLOAD',
      eventType: row.eventType,
      version: envelope.version ?? null,
    };
    const sourceKey = `invalid-domain-event:${envelope.eventId ?? row.id}`;
    const created = await this.prisma.notificationIntent.createMany({
      data: consumers.map((consumerKey) => ({
        sourceKey,
        consumerKey,
        sourceOutboxId: row.id,
        payloadVersion: envelope.version ?? 0,
        payload,
        payloadHash: hashPayload(payload),
        status: 'DEAD' as const,
      })),
      skipDuplicates: true,
    });
    return created.count;
  }

  private consumersFor(eventType: string): NotificationOutboxConsumerKey[] {
    if (eventType === 'bookings.booking.created') {
      return [NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CREATED_STAFF];
    }
    if (eventType === 'bookings.booking.cancelled') {
      return [
        NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CANCELLED_CLIENT,
        NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CANCELLED_STAFF,
      ];
    }
    return [
      NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT,
      NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_STAFF,
    ];
  }

  private commandsFor(eventType: string, envelope: Required<Envelope>) {
    const value = envelope.payload;
    const base = {
      payloadVersion: NOTIFICATION_OUTBOX_PAYLOAD_VERSION,
      occurredAt: new Date(envelope.occurredAt),
    };
    if (eventType === 'bookings.booking.created') {
      return [{
        ...base,
        sourceKey: notificationSourceKey.domainEvent(envelope.eventId),
        consumerKey: NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CREATED_STAFF,
        payload: {
          kind: 'booking-created-staff' as const,
          bookingId: value.bookingId as string,
          bookingNumber: value.bookingNumber as number | undefined,
          employeeId: value.employeeId as string | undefined,
        },
      }];
    }
    if (eventType === 'bookings.booking.cancelled') {
      return [
        {
          ...base,
          sourceKey: notificationSourceKey.domainEvent(envelope.eventId),
          consumerKey: NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CANCELLED_CLIENT,
          payload: {
            kind: 'booking-cancelled-client' as const,
            bookingId: value.bookingId as string,
            clientId: value.clientId as string,
            reason: value.reason as string,
            clientName: value.clientName as string | undefined,
            clientPhone: value.clientPhone as string | undefined,
            clientEmail: value.clientEmail as string | undefined,
          },
        },
        {
          ...base,
          sourceKey: notificationSourceKey.domainEvent(envelope.eventId),
          consumerKey: NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CANCELLED_STAFF,
          payload: {
            kind: 'booking-cancelled-staff' as const,
            bookingId: value.bookingId as string,
            bookingNumber: value.bookingNumber as number | undefined,
            employeeId: value.employeeId as string | undefined,
            reason: value.reason as string,
          },
        },
      ];
    }
    return [
      {
        ...base,
        sourceKey: notificationSourceKey.clientEnrolled(value.clientId as string),
        consumerKey: NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT,
        payload: {
          kind: 'client-enrolled-client' as const,
          clientId: value.clientId as string,
          name: String(value.name ?? ''),
          phone: value.phone as string | undefined,
          email: value.email as string | undefined,
        },
      },
      {
        ...base,
        sourceKey: notificationSourceKey.clientEnrolled(value.clientId as string),
        consumerKey: NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_STAFF,
        payload: {
          kind: 'client-enrolled-staff' as const,
          clientId: value.clientId as string,
          name: String(value.name ?? ''),
        },
      },
    ];
  }
}
