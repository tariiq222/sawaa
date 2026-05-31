import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { EventBusService } from '../../../infrastructure/events';
import { withCronLeader } from '../../../common/helpers/cron-leader.helper';
import { DEFAULT_ORG_ID } from '../../../common/constants';

/** Event name consumed by comms `OnBookingReminderHandler`. */
const REMINDER_EVENT = 'ops.booking.reminder_due';

/** Default reminder lead time when no OrgSettings row exists (mirrors schema default). */
const DEFAULT_REMINDER_LEAD_MINUTES = 60;

/**
 * The cron runs every 5 minutes (see CRON_JOBS.APPOINTMENT_REMINDERS pattern),
 * so each tick scans a 5-minute slice of upcoming bookings. The window must
 * match the tick interval to avoid gaps/overlaps in coverage.
 */
export const REMINDER_WINDOW_MINUTES = 5;

/**
 * Redis de-dup TTL. Must comfortably exceed the lead time so a booking is
 * never reminded twice across ticks even if the lead time is large. We cap it
 * at 25h to cover a same-day next-morning reminder without leaking keys.
 */
const REMINDER_DEDUP_TTL_SECONDS = 25 * 60 * 60;

/**
 * Sends appointment reminders for CONFIRMED bookings whose start time falls in
 * the next [lead, lead + window) slice. De-dup is enforced with a Redis key per
 * booking (no schema column) so a redelivered cron tick never double-sends.
 *
 * Cross-cluster delivery goes through the domain event bus: this cron publishes
 * `ops.booking.reminder_due` and the comms `OnBookingReminderHandler` fans it
 * out across in-app/sms/push/email channels.
 */
@Injectable()
export class AppointmentRemindersCron {
  private readonly logger = new Logger(AppointmentRemindersCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(): Promise<void> {
    await withCronLeader(this.prisma, 'appointment-reminders', async () => {
      const leadMinutes = await this.resolveLeadMinutes();

      const now = Date.now();
      const windowStart = new Date(now + leadMinutes * 60_000);
      const windowEnd = new Date(now + (leadMinutes + REMINDER_WINDOW_MINUTES) * 60_000);

      const bookings = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.CONFIRMED,
          scheduledAt: { gte: windowStart, lt: windowEnd },
        },
        select: {
          id: true,
          clientId: true,
          scheduledAt: true,
          serviceId: true,
          serviceNameSnapshot: true,
        },
        orderBy: { scheduledAt: 'asc' },
        take: 200,
      });

      if (bookings.length === 0) return;

      let sent = 0;
      let skipped = 0;
      for (const booking of bookings) {
        try {
          if (await this.alreadyReminded(booking.id)) {
            skipped += 1;
            continue;
          }

          const [client, serviceName] = await Promise.all([
            this.prisma.client.findUnique({
              where: { id: booking.clientId },
              select: { name: true, phone: true, email: true },
            }),
            this.resolveServiceName(booking.serviceId, booking.serviceNameSnapshot),
          ]);

          await this.eventBus.publish(REMINDER_EVENT, {
            eventId: randomUUID(),
            source: 'ops.appointment-reminders-cron',
            version: 1,
            occurredAt: new Date(),
            payload: {
              bookingId: booking.id,
              clientId: booking.clientId,
              scheduledAt: booking.scheduledAt,
              clientName: client?.name ?? undefined,
              clientPhone: client?.phone ?? undefined,
              clientEmail: client?.email ?? undefined,
              serviceName: serviceName ?? undefined,
              organizationId: DEFAULT_ORG_ID,
            },
          });

          await this.markReminded(booking.id);
          sent += 1;
        } catch (err) {
          this.logger.error(
            `appointment-reminders: failed to enqueue reminder for booking ${booking.id}`,
            err instanceof Error ? err.stack : err,
          );
        }
      }

      this.logger.log(
        `appointment-reminders: lead=${leadMinutes}m window=${REMINDER_WINDOW_MINUTES}m → ${sent} sent, ${skipped} already-reminded, ${bookings.length} matched`,
      );
    });
  }

  private async resolveLeadMinutes(): Promise<number> {
    const settings = await this.prisma.organizationSettings.findFirst({
      select: { reminderBeforeMinutes: true },
    });
    const lead = settings?.reminderBeforeMinutes;
    return typeof lead === 'number' && lead > 0 ? lead : DEFAULT_REMINDER_LEAD_MINUTES;
  }

  private async resolveServiceName(
    serviceId: string,
    snapshot: string | null,
  ): Promise<string | null> {
    if (snapshot) return snapshot;
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { nameAr: true, nameEn: true },
    });
    return service?.nameAr ?? service?.nameEn ?? null;
  }

  private dedupKey(bookingId: string): string {
    return `reminder:${bookingId}`;
  }

  private async alreadyReminded(bookingId: string): Promise<boolean> {
    const existing = await this.redis.getClient().get(this.dedupKey(bookingId));
    return existing !== null;
  }

  private async markReminded(bookingId: string): Promise<void> {
    await this.redis
      .getClient()
      .set(this.dedupKey(bookingId), '1', 'EX', REMINDER_DEDUP_TTL_SECONDS);
  }
}
