import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingType,
  CancellationReason,
  Prisma,
  RefundType,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { stableEventId } from '../../../common/events';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { ClientCancelBookingDto } from './client-cancel-booking.dto';
import { BookingCancelledEvent } from '../events/booking-cancelled.event';
import { RefundPaymentHandler } from '../../finance/refund-payment/refund-payment.handler';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { assertTransition } from '../booking-state-machine';
import { computeRefundAmountHalalas } from '../cancellation-policy';
import { ProgramCapacityService } from '../program/program-capacity.service';
import {
  assertBookingIsMutable,
  hashToInt32,
  updateBookingAtomically,
} from '../booking-lifecycle.helper';
import { calculateClientCancellation, RESERVED_REFUND_STATUSES, type CancellationRefundSummary, type ClientCancellationSettings } from './client-cancellation-policy';
import { readCancellationPayments } from './client-cancellation-preview.handler';
import { returnPackageCreditForBooking } from '../package-credit-return.helper';

export type ClientCancelCommand = ClientCancelBookingDto & {
  bookingId: string;
  clientId: string;
  sourceActionId?: string;
  transaction?: Prisma.TransactionClient;
  /** Server-derived transport semantics; never accepted from a client DTO. */
  legacyChannel?: 'PUBLIC' | 'MOBILE';
  cancellationReason?: CancellationReason;
};

type CancelResult = {
  status: 'CANCELLED' | 'CANCEL_REQUESTED';
  booking: Awaited<ReturnType<typeof updateBookingAtomically>>;
  requiresApproval: boolean;
  refund?: CancellationRefundSummary;
};

@Injectable()
export class ClientCancelBookingHandler {
  constructor(
    _prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    _eventBus: EventBusService,
    private readonly refundHandler: RefundPaymentHandler,
    private readonly programCapacity: ProgramCapacityService,
  ) {}

  async execute(cmd: ClientCancelCommand): Promise<CancelResult> {
    if (cmd.acceptedRefundTerms !== true || typeof cmd.quoteToken !== 'string' || !/^[a-f0-9]{64}$/.test(cmd.quoteToken)) {
      throw new BadRequestException('Explicit acceptance and a current cancellation preview token are required');
    }
    const actionHash = this.actionHash(cmd);
    const cancellationEventId = cmd.sourceActionId
      ? stableEventId(`booking:${cmd.bookingId}:client-cancel:${cmd.sourceActionId}`)
      : randomUUID();
    const mutate = async (tx: Prisma.TransactionClient): Promise<CancelResult> => {
      // Cancellation needs no employee-slot lock. The client lock precedes the booking mutation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${hashToInt32('client_booking')}::int, ${hashToInt32(cmd.clientId)}::int)`;
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${cmd.bookingId} FOR UPDATE`);
      const booking = await tx.booking.findUnique({ where: { id: cmd.bookingId } });
      if (!booking) throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
      if (booking.clientId !== cmd.clientId) throw new ForbiddenException('You do not own this booking');
      assertBookingIsMutable(booking);

      if (cmd.sourceActionId) {
        const previous = await tx.bookingStatusLog.findUnique({
          where: { sourceActionId: cmd.sourceActionId },
        });
        if (previous) {
          if (previous.sourceActionHash !== actionHash || previous.bookingId !== cmd.bookingId) {
            throw new ConflictException('Action id was already used with different cancellation data');
          }
          const stored = previous.sourceActionResult as Record<string, unknown> | null;
          const status = stored?.status;
          if (status !== 'CANCELLED' && status !== 'CANCEL_REQUESTED') {
            throw new ConflictException('Stored cancellation result is invalid');
          }
          return {
            status,
            booking,
            requiresApproval: stored?.requiresApproval === true,
            ...(stored?.refund ? { refund: stored.refund as unknown as CancellationRefundSummary } : {}),
          };
        }
      }

      if (booking.bookingType === BookingType.GROUP) {
        throw new ForbiddenException('Program enrollments can only be cancelled by staff');
      }
      const settings = await this.settingsHandler.execute({
        branchId: booking.branchId,
        transaction: tx,
      });
      if ((settings as ClientCancellationSettings).clientCancellationPolicyEnabled) {
        return this.cancelWithPolicy(tx, cmd, booking, settings as ClientCancellationSettings, cancellationEventId, actionHash);
      }
      const payments = await readCancellationPayments(tx, booking.id, true);
      const quote = calculateClientCancellation(booking, settings, payments, new Date(), cmd.legacyChannel);
      if (cmd.quoteToken !== quote.quoteToken) throw new ConflictException('Cancellation terms changed. Reload the cancellation preview.');
      if (!quote.canCancel) throw new BadRequestException({ message: 'Client cancellation is unavailable', reasonCode: quote.reasonCode });
      // The money locks may have waited across the legacy free-window boundary.
      if (calculateClientCancellation(booking, settings, payments, new Date(), cmd.legacyChannel).quoteToken !== quote.quoteToken) {
        throw new ConflictException('Cancellation terms changed. Reload the cancellation preview.');
      }
      if (quote.requiresApproval) {
        const nextStatus = assertTransition(booking.status, 'CLIENT_REQUEST_CANCEL');
        const updated = await updateBookingAtomically(tx, {
          bookingId: cmd.bookingId,
          currentStatus: booking.status,
          actionLabel: 'cancel requested',
          data: { status: nextStatus, cancelNotes: cmd.reason ?? null, ...(cmd.legacyChannel === 'MOBILE' ? { cancelReason: cmd.cancellationReason ?? CancellationReason.CLIENT_REQUESTED } : {}) },
          ...(booking.deliveryType === 'ONLINE' ? {
            extraWhere: {
              AND: [
                { OR: [
                  { zoomCreateLeaseOwner: null },
                  { zoomCreateLeaseExpiresAt: null },
                  { zoomCreateLeaseExpiresAt: { lt: new Date() } },
                ] },
                { OR: [
                  { zoomSyncLeaseOwner: null },
                  { zoomSyncLeaseExpiresAt: null },
                  { zoomSyncLeaseExpiresAt: { lt: new Date() } },
                ] },
              ],
            },
          } : {}),
        });
        await tx.bookingStatusLog.create({
          data: {
            bookingId: cmd.bookingId,
            fromStatus: booking.status,
            toStatus: nextStatus,
            changedBy: cmd.clientId,
            reason: cmd.reason ?? (
              settings.requireCancelApproval
                ? 'CLIENT_CANCEL_REQUIRES_APPROVAL'
                : 'CLIENT_CANCEL_WINDOW_EXPIRED'
            ),
            sourceActionId: cmd.sourceActionId,
            sourceActionHash: cmd.sourceActionId ? actionHash : undefined,
            sourceActionResult: cmd.sourceActionId
              ? {
                  kind: 'CANCELLATION', bookingId: cmd.bookingId,
                  status: 'CANCEL_REQUESTED', requiresApproval: true,
                }
              : undefined,
          },
        });
        return { status: 'CANCEL_REQUESTED', booking: updated, requiresApproval: true };
      }

      const directCancelStatus = assertTransition(booking.status, 'CLIENT_DIRECT_CANCEL');
      // Execute the accepted quote, including the legacy mobile hold's FULL
      // entitlement. A later clock tick must not choose another refund tier.
      const refundPercent = quote.refund.refundPercent;
      const refundType = refundPercent === 100 ? RefundType.FULL
        : refundPercent > 0 ? RefundType.PARTIAL : RefundType.NONE;
      let refundRequestId: string | null = null;
      let paymentId: string | null = null;
      let idempotencyKey: string | null = null;

      const cancelled = await updateBookingAtomically(tx, {
        bookingId: cmd.bookingId,
        currentStatus: booking.status,
        actionLabel: 'cancelled',
        data: {
          status: directCancelStatus,
          cancelReason: cmd.cancellationReason ?? CancellationReason.CLIENT_REQUESTED,
          cancelNotes: cmd.reason ?? null,
          cancelledAt: new Date(),
          ...(cmd.legacyChannel === 'MOBILE' && booking.zoomMeetingId ? { zoomMeetingStatus: 'CANCELLED' } : {}),
        },
        ...(booking.deliveryType === 'ONLINE' ? {
          extraWhere: {
            AND: [
              { OR: [
                { zoomCreateLeaseOwner: null },
                { zoomCreateLeaseExpiresAt: null },
                { zoomCreateLeaseExpiresAt: { lt: new Date() } },
              ] },
              { OR: [
                { zoomSyncLeaseOwner: null },
                { zoomSyncLeaseExpiresAt: null },
                { zoomSyncLeaseExpiresAt: { lt: new Date() } },
              ] },
            ],
          },
        } : {}),
      });
      await tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: directCancelStatus,
          changedBy: cmd.clientId,
          reason: cmd.legacyChannel === 'MOBILE' ? cmd.cancellationReason ?? CancellationReason.CLIENT_REQUESTED : cmd.reason ?? 'CLIENT_CANCEL',
          sourceActionId: cmd.sourceActionId,
          sourceActionHash: cmd.sourceActionId ? actionHash : undefined,
          sourceActionResult: cmd.sourceActionId
            ? {
                kind: 'CANCELLATION', bookingId: cmd.bookingId,
                status: 'CANCELLED', requiresApproval: false,
              }
            : undefined,
        },
      });

      if (refundType !== RefundType.NONE) {
        // The preview and execution select the same capture deterministically.
        const completedPayment = payments.find(payment => payment.status === 'COMPLETED');
        if (completedPayment) {
          const paidHalalas = Number(completedPayment.amount);
          const refundAmount = refundType === RefundType.FULL
            ? undefined
            : computeRefundAmountHalalas(paidHalalas, refundPercent);
          if (refundAmount === undefined || refundAmount > 0) {
            const created = await this.refundHandler.createRefundRequestInTx(tx, {
              paymentId: completedPayment.id,
              reason: `Booking ${cmd.bookingId} cancellation (${refundType})`,
              performedBy: cmd.clientId,
              amount: refundAmount,
              sourceEventId: cancellationEventId,
            });
            paymentId = completedPayment.id;
            refundRequestId = created.refundRequestId;
            idempotencyKey = created.idempotencyKey;
          }
        }
      }
      if (cmd.legacyChannel === 'MOBILE' && booking.couponCode) {
        await tx.coupon.updateMany({ where: { code: booking.couponCode, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
      }
      if (booking.packageCreditId) await returnPackageCreditForBooking(tx, cmd.bookingId);
      if (booking.programId) {
        await tx.programEnrollment.deleteMany({ where: { bookingId: cmd.bookingId } });
        await this.programCapacity.decrementEnrollment(tx, booking.programId);
      }

      const event = new BookingCancelledEvent({
        organizationId: DEFAULT_ORG_ID,
        scheduledAt: booking.scheduledAt,
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        clientId: booking.clientId,
        employeeId: booking.employeeId,
        reason: cmd.cancellationReason ?? CancellationReason.CLIENT_REQUESTED,
        ...(cmd.legacyChannel === 'MOBILE' ? { zoomMeetingId: booking.zoomMeetingId, legacyClientCancellation: true } : {}),
        cancelNotes: cmd.reason ?? undefined,
        refundType,
        paymentId,
        refundRequestId,
        idempotencyKey,
      }, cancellationEventId);
      await tx.outboxEvent.create({
        data: {
          id: event.eventId,
          aggregateId: booking.id,
          eventType: event.eventName,
          payload: event.toEnvelope() as unknown as Prisma.InputJsonValue,
        },
      });
      return { status: 'CANCELLED', booking: cancelled, requiresApproval: false };
    };

    const result = cmd.transaction
      ? await mutate(cmd.transaction)
      : await this.rlsTransaction.withTransaction(mutate, { isolationLevel: 'Serializable' });
    return cmd.transaction ? result : {
      status: result.status,
      booking: result.booking,
      requiresApproval: result.requiresApproval,
      ...(result.refund ? { refund: result.refund } : {}),
    };
  }

  private async cancelWithPolicy(
    tx: Prisma.TransactionClient,
    cmd: ClientCancelCommand,
    booking: NonNullable<Awaited<ReturnType<Prisma.TransactionClient['booking']['findUnique']>>>,
    settings: ClientCancellationSettings,
    eventId: string,
    actionHash: string,
  ): Promise<CancelResult> {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE`);
    const payments = await readCancellationPayments(tx, booking.id, true);
    const quote = calculateClientCancellation(booking, settings, payments);
    if (cmd.quoteToken !== quote.quoteToken) {
      throw new ConflictException('Cancellation terms changed. Reload the cancellation preview.');
    }
    if (!quote.canCancel) throw new BadRequestException({ message: 'Client cancellation is unavailable', reasonCode: quote.reasonCode });
    const nextStatus = assertTransition(booking.status, 'CLIENT_DIRECT_CANCEL');
    const now = new Date();
    // Recheck the deadline after all money/booking locks have been obtained.
    if (calculateClientCancellation(booking, settings, payments, now).quoteToken !== quote.quoteToken) {
      throw new ConflictException('Cancellation cutoff passed. Reload the cancellation preview.');
    }
    const cancelled = await updateBookingAtomically(tx, {
      bookingId: booking.id, currentStatus: booking.status, actionLabel: 'cancelled',
      data: { status: nextStatus, cancelReason: 'CLIENT_REQUESTED', cancelNotes: cmd.reason ?? null, cancelledAt: now, ...(booking.zoomMeetingId ? { zoomMeetingStatus: 'CANCELLED' } : {}) },
      extraWhere: {
        clientId: cmd.clientId, checkedInAt: null, isHistoricalImport: false,
        scheduledAt: booking.scheduledAt, endsAt: booking.endsAt,
        AND: [
          settings.clientCancelCutoffMode === 'BEFORE_START'
            ? { scheduledAt: { gte: new Date(now.getTime() + settings.clientCancelBeforeHours! * 3600000) } }
            : { endsAt: { gt: now } },
          ...(booking.deliveryType === 'ONLINE' ? [
          { OR: [{ zoomCreateLeaseOwner: null }, { zoomCreateLeaseExpiresAt: null }, { zoomCreateLeaseExpiresAt: { lt: now } }] },
          { OR: [{ zoomSyncLeaseOwner: null }, { zoomSyncLeaseExpiresAt: null }, { zoomSyncLeaseExpiresAt: { lt: now } }] },
          ] : []),
        ],
      },
    });
    if (booking.packageCreditId) {
      const returned = await returnPackageCreditForBooking(tx, booking.id);
      if (!returned) {
        const priorReturn = await tx.packageCreditUsage.findFirst({ where: { bookingId: booking.id, status: 'RETURNED' }, select: { id: true } });
        if (!priorReturn) throw new ConflictException('Package credit return needs staff review');
      }
    }
    const refund = quote.refund;
    await tx.bookingStatusLog.create({ data: {
      bookingId: booking.id, fromStatus: booking.status, toStatus: nextStatus, changedBy: cmd.clientId,
      reason: cmd.reason ?? 'CLIENT_CANCEL', sourceActionId: cmd.sourceActionId,
      sourceActionHash: cmd.sourceActionId ? actionHash : undefined,
      sourceActionResult: { kind: 'CANCELLATION', bookingId: booking.id, status: 'CANCELLED', requiresApproval: false, refund, cancellationEventId: eventId } as unknown as Prisma.InputJsonValue,
    } });
    const event = new BookingCancelledEvent({
      organizationId: DEFAULT_ORG_ID, scheduledAt: booking.scheduledAt, bookingId: booking.id,
      bookingNumber: booking.bookingNumber, clientId: booking.clientId, employeeId: booking.employeeId,
      reason: CancellationReason.CLIENT_REQUESTED, cancelNotes: cmd.reason,
      zoomMeetingId: booking.zoomMeetingId,
      refundType: refund.refundPercent === 100 ? 'FULL' : refund.refundPercent > 0 ? 'PARTIAL' : 'NONE',
      paymentId: null,
      clientCancellation: { version: 1, initiatedBy: 'CLIENT', refund, allocations: quote.allocations, pendingRequestIds: payments.flatMap(p => p.refundRequests).filter(r => RESERVED_REFUND_STATUSES.includes(r.status)).map(r => r.id) },
    }, eventId);
    await tx.outboxEvent.create({ data: { id: eventId, aggregateId: booking.id, eventType: event.eventName, payload: event.toEnvelope() as unknown as Prisma.InputJsonValue } });
    return { status: 'CANCELLED', booking: cancelled, requiresApproval: false, refund };
  }

  private actionHash(cmd: ClientCancelCommand): string {
    return createHash('sha256')
      .update(JSON.stringify({
        action: 'CLIENT_CANCELLATION',
        bookingId: cmd.bookingId,
        clientId: cmd.clientId,
        reason: cmd.reason ?? null,
        acceptedRefundTerms: cmd.acceptedRefundTerms,
        quoteToken: cmd.quoteToken,
        legacyChannel: cmd.legacyChannel ?? 'PUBLIC',
        cancellationReason: cmd.cancellationReason ?? CancellationReason.CLIENT_REQUESTED,
      }))
      .digest('hex');
  }
}
