import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/database';
import { NotificationOutboxConfig } from './notification-outbox.config';
import { CaptureNotificationIntentHandler } from './capture-notification-intent.handler';
import { NOTIFICATION_OUTBOX_CONSUMERS, NOTIFICATION_OUTBOX_REMINDER_POLICY_VERSION, NOTIFICATION_OUTBOX_PAYLOAD_VERSION, NotificationOutboxTickResult, notificationSourceKey } from './notification-outbox.types';

const PAGE_SIZE = 200;
const DEFAULT_REMINDER_BEFORE_MINUTES = 60;

@Injectable()
export class CaptureReminderNotificationIntentsHandler {
  constructor(private readonly prisma: PrismaService, private readonly capture: CaptureNotificationIntentHandler, private readonly config: NotificationOutboxConfig) {}

  async execute(): Promise<NotificationOutboxTickResult> {
    const settings = await this.prisma.organizationSettings.findFirst({ select: { reminderBeforeMinutes: true } });
    const leadMinutes = typeof settings?.reminderBeforeMinutes === 'number' && settings.reminderBeforeMinutes > 0 ? settings.reminderBeforeMinutes : DEFAULT_REMINDER_BEFORE_MINUTES;
    const now = new Date();
    const dueThrough = new Date(now.getTime() + leadMinutes * 60_000);
    let cursor: string | undefined; let examined = 0; let changed = 0; let failed = 0;
    for (;;) {
      const bookings = await this.prisma.booking.findMany({ where: { status: { in: ['CONFIRMED', 'DEPOSIT_PAID'] }, scheduledAt: { gt: now, lte: dueThrough } , ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: PAGE_SIZE, select: { id: true, clientId: true, scheduledAt: true, serviceNameSnapshot: true } });
      if (!bookings.length) break;
      const clients = await this.prisma.client.findMany({
        where: { id: { in: bookings.map((booking) => booking.clientId) }, isActive: true, deletedAt: null },
        select: { id: true, name: true, phone: true, email: true },
      });
      const clientsById = new Map(clients.map((client) => [client.id, client]));
      for (const booking of bookings) {
        cursor = booking.id; examined += 1;
        const dueAt = new Date(new Date(booking.scheduledAt).getTime() - leadMinutes * 60_000);
        if (!this.config.shouldCapture(dueAt)) continue;
        try {
          const sourceKey = notificationSourceKey.reminder(booking.id, booking.scheduledAt, NOTIFICATION_OUTBOX_REMINDER_POLICY_VERSION);
          const existing = await this.prisma.notificationIntent.findUnique({
            where: { sourceKey_consumerKey: { sourceKey, consumerKey: NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_REMINDER_CLIENT } },
            select: { id: true },
          });
          if (existing) continue;
          const client = clientsById.get(booking.clientId);
          await this.capture.execute({ sourceKey, consumerKey: NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_REMINDER_CLIENT, payloadVersion: NOTIFICATION_OUTBOX_PAYLOAD_VERSION, occurredAt: dueAt, expiresAt: new Date(booking.scheduledAt), payload: { kind: 'booking-reminder-client', bookingId: booking.id, clientId: booking.clientId, scheduledAt: new Date(booking.scheduledAt).toISOString(), clientName: client?.name ?? undefined, clientPhone: client?.phone ?? undefined, clientEmail: client?.email ?? undefined, serviceName: booking.serviceNameSnapshot ?? undefined, policyVersion: NOTIFICATION_OUTBOX_REMINDER_POLICY_VERSION } });
          changed += 1;
        } catch { failed += 1; }
      }
    }
    return { examined, changed, failed };
  }
}
