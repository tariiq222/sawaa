import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface GetBookingTimelineQuery {
  bookingId: string;
}

export type BookingTimelineKind =
  | 'CREATED'
  | 'STATUS_CHANGE'
  | 'RESCHEDULE'
  | 'PAYMENT'
  | 'REFUND'
  | 'ACTIVITY';

export interface BookingTimelineEntry {
  id: string;
  kind: BookingTimelineKind;
  /** ISO timestamp the event occurred at. */
  at: string;
  /** Who triggered it: a user id, a system actor, or null. */
  actor: string | null;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus | null;
  reason: string | null;
  /** Money in integer halalas (payment / refund entries only). */
  amount: number | null;
  method: PaymentMethod | null;
  paymentStatus: PaymentStatus | null;
  refundStatus: RefundStatus | null;
  /** Structured extras (e.g. reschedule from/to times). */
  meta: Record<string, unknown> | null;
}

/** A reschedule status-log row is deduped against an ActivityLog reschedule
 * within this window (the two writes share one transaction, milliseconds apart). */
const RESCHEDULE_DEDUPE_MS = 10_000;

function isRescheduleActivity(metadata: unknown): metadata is {
  fromScheduledAt?: string;
  toScheduledAt?: string;
} {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    'fromScheduledAt' in metadata
  );
}

/**
 * Aggregates a chronological, read-only activity timeline for a single booking
 * by merging what is already recorded across tables:
 *   - the booking creation moment,
 *   - every BookingStatusLog transition,
 *   - payments (created + settled) on the booking's invoices,
 *   - refund requests (raised + processed),
 *   - generic ActivityLog rows scoped to the booking.
 *
 * It writes nothing and touches no payment logic — it only surfaces existing
 * data. Coverage is therefore only as complete as what each flow already
 * records; comprehensive forward logging is a separate concern.
 */
@Injectable()
export class GetBookingTimelineHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: GetBookingTimelineQuery,
  ): Promise<BookingTimelineEntry[]> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: query.bookingId },
      select: { id: true, createdAt: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const [statusLogs, invoices, activityLogs] = await Promise.all([
      this.prisma.bookingStatusLog.findMany({
        where: { bookingId: query.bookingId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.invoice.findMany({
        where: { bookingId: query.bookingId },
        select: {
          id: true,
          payments: {
            select: {
              id: true,
              amount: true,
              method: true,
              status: true,
              createdAt: true,
              processedAt: true,
            },
          },
          refundRequests: {
            select: {
              id: true,
              amount: true,
              status: true,
              reason: true,
              processedBy: true,
              denialReason: true,
              createdAt: true,
              processedAt: true,
            },
          },
        },
      }),
      this.prisma.activityLog.findMany({
        where: { entity: 'Booking', entityId: query.bookingId },
        orderBy: { occurredAt: 'asc' },
      }),
    ]);

    const entries: BookingTimelineEntry[] = [];
    const base = (): Omit<BookingTimelineEntry, 'id' | 'kind' | 'at'> => ({
      actor: null,
      fromStatus: null,
      toStatus: null,
      reason: null,
      amount: null,
      method: null,
      paymentStatus: null,
      refundStatus: null,
      meta: null,
    });

    // Timestamps of structured reschedule ActivityLog rows — used to suppress the
    // matching (metadata-less) status-log reschedule row so each reschedule shows
    // exactly once, with its old/new times.
    const rescheduleActivityTimes = activityLogs
      .filter((a) => isRescheduleActivity(a.metadata))
      .map((a) => a.occurredAt.getTime());

    entries.push({
      id: `created:${booking.id}`,
      kind: 'CREATED',
      at: booking.createdAt.toISOString(),
      ...base(),
    });

    for (const log of statusLogs) {
      const isReschedule = log.reason === 'rescheduled';
      // Drop the bare reschedule status-log row when a richer ActivityLog
      // reschedule (with old/new times) covers the same moment.
      if (
        isReschedule &&
        rescheduleActivityTimes.some(
          (t) => Math.abs(t - log.createdAt.getTime()) < RESCHEDULE_DEDUPE_MS,
        )
      ) {
        continue;
      }
      entries.push({
        ...base(),
        id: `status:${log.id}`,
        kind: isReschedule ? 'RESCHEDULE' : 'STATUS_CHANGE',
        at: log.createdAt.toISOString(),
        actor: log.changedBy,
        // A reschedule keeps the same status; suppress the from/to chips so it
        // does not render as a confusing same-status transition.
        fromStatus: isReschedule ? null : log.fromStatus,
        toStatus: isReschedule ? null : log.toStatus,
        reason: isReschedule ? null : log.reason,
      });
    }

    for (const invoice of invoices) {
      for (const payment of invoice.payments) {
        entries.push({
          ...base(),
          id: `payment:${payment.id}`,
          kind: 'PAYMENT',
          at: (payment.processedAt ?? payment.createdAt).toISOString(),
          amount: Number(payment.amount),
          method: payment.method,
          paymentStatus: payment.status,
        });
      }
      for (const refund of invoice.refundRequests) {
        entries.push({
          ...base(),
          id: `refund:${refund.id}`,
          kind: 'REFUND',
          at: (refund.processedAt ?? refund.createdAt).toISOString(),
          actor: refund.processedBy,
          amount: Number(refund.amount),
          reason: refund.denialReason ?? refund.reason,
          refundStatus: refund.status,
        });
      }
    }

    for (const activity of activityLogs) {
      const reschedule = isRescheduleActivity(activity.metadata);
      entries.push({
        ...base(),
        id: `activity:${activity.id}`,
        kind: reschedule ? 'RESCHEDULE' : 'ACTIVITY',
        at: activity.occurredAt.toISOString(),
        actor: activity.userId ?? activity.userEmail,
        reason: reschedule ? null : activity.description,
        meta: reschedule
          ? (activity.metadata as Record<string, unknown>)
          : null,
      });
    }

    entries.sort((a, b) => a.at.localeCompare(b.at));
    return entries;
  }
}
