import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, CancellationReason, Prisma, RefundType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { stableEventId } from '../../../common/events';
import { BookingCancelledEvent } from '../events/booking-cancelled.event';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { assertProgramTransition } from '../program/program-state-machine';
import { CancelProgramDto } from '../enroll-in-program/enroll-in-program.dto';
import { buildStaffCancellationIntent } from '../../finance/cancellation-refund/staff-cancellation-refund';
import { buildProgramCancellationPreview, resolveProgramRefunds } from './program-cancellation-policy';

const cancellableStatuses: BookingStatus[] = ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'CANCEL_REQUESTED', 'DEPOSIT_PAID', 'PENDING_GROUP_FILL'];

/** Commit cancellation and its frozen financial intent together; finance executes after commit. */
@Injectable()
export class CancelProgramHandler {
  constructor(private readonly prisma: PrismaService, private readonly rlsTransaction: RlsTransactionService) {}

  async preview(programId: string) {
    return this.transaction(async tx => (await this.snapshot(tx, programId)).preview);
  }

  async execute(programId: string, dto: CancelProgramDto, performedBy: string) {
    return this.transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Program" WHERE id = ${programId} FOR UPDATE NOWAIT`;
      const resultId = stableEventId(`program:${programId}:cancel-result`);
      const previous = await tx.outboxEvent.findUnique({ where: { id: resultId } });
      if (previous) return (previous.payload as unknown as { payload: ProgramCancellationResult }).payload;
      const { program, bookings, preview } = await this.snapshot(tx, programId);
      const nextStatus = assertProgramTransition(program.status, 'CANCEL');
      if (dto.quoteToken !== preview.quoteToken) throw new ConflictException({ message: 'Program cancellation quote changed', preview });
      const amounts = resolveProgramRefunds(preview, dto.refunds);
      const reason = `إلغاء البرنامج ${program.nameAr}: ${dto.reason}`;
      let cancelledEnrollments = 0;
      const participants: ProgramCancellationResult['participants'] = [];
      for (const booking of bookings) {
        if (booking.isHistoricalImport) continue;
        const changed = cancellableStatuses.includes(booking.status);
        const eventId = stableEventId(`booking:${booking.id}:program-cancel:${programId}`);
        const intent = buildStaffCancellationIntent({ payments: booking.payments, currency: booking.currency,
          refundAmount: amounts.get(booking.id) ?? 0, initiatedBy: 'CENTER', reason, performedBy, automatic: true });
        if (changed) {
          const updated = await tx.booking.updateMany({ where: { id: booking.id, status: booking.status, isHistoricalImport: false }, data: {
            status: 'CANCELLED', cancelReason: CancellationReason.SYSTEM_EXPIRED, cancelNotes: reason, cancelledAt: new Date(),
          } });
          if (updated.count !== 1) throw new ConflictException('Participant changed; refresh cancellation preview');
          cancelledEnrollments++;
          await tx.bookingStatusLog.create({ data: { bookingId: booking.id, fromStatus: booking.status, toStatus: 'CANCELLED', changedBy: performedBy, reason,
            sourceActionResult: { cancellationEventId: eventId },
          } });
        }
        participants.push({ bookingId: booking.id, refundAmount: intent.refund.refundAmount, currency: booking.currency,
          refundStatus: intent.allocations.length ? intent.allocations.some(a => a.execution === 'REVIEW') ? 'PENDING_REVIEW' : 'PROCESSING' : 'NO_REFUND' });
        // Terminal participants retain their booking history. A financial entitlement
        // still gets the program-specific notice and a stable financial consumer identity.
        if (!changed && !intent.allocations.length) continue;
        const event = new BookingCancelledEvent({ organizationId: DEFAULT_ORG_ID, scheduledAt: booking.scheduledAt,
          bookingId: booking.id, bookingNumber: booking.bookingNumber, clientId: booking.clientId, employeeId: booking.employeeId,
          reason: CancellationReason.SYSTEM_EXPIRED, cancelNotes: reason, refundType: RefundType.NONE, paymentId: null, centerCancellation: intent,
        }, eventId);
        await tx.outboxEvent.create({ data: { id: eventId, aggregateId: booking.id, eventType: event.eventName, payload: event.toEnvelope() as unknown as Prisma.InputJsonValue } });
      }
      await tx.program.update({ where: { id: programId }, data: { status: nextStatus, cancelReason: dto.reason, cancelledAt: new Date(), enrolledCount: 0 } });
      const result: ProgramCancellationResult = { id: programId, status: nextStatus, cancelledEnrollments, skippedEnrollments: bookings.length - cancelledEnrollments, participants };
      await tx.outboxEvent.create({ data: { id: resultId, aggregateId: programId, eventType: 'bookings.program.cancelled', payload: {
        eventId: resultId, source: 'bookings', version: 1, occurredAt: new Date().toISOString(), payload: result,
      } as unknown as Prisma.InputJsonValue } });
      return result;
    });
  }

  private async snapshot(tx: Prisma.TransactionClient, programId: string) {
    // NOWAIT breaks the inverse Booking->Program order used by existing staff
    // lifecycle paths. The caller receives 409 and must obtain a fresh quote.
    await tx.$queryRaw`SELECT id FROM "Program" WHERE id = ${programId} FOR UPDATE NOWAIT`;
    const program = await tx.program.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException('Program not found');
    await tx.$queryRaw`SELECT b.id FROM "Booking" b JOIN "ProgramEnrollment" e ON e."bookingId" = b.id WHERE e."programId" = ${programId} ORDER BY b.id FOR UPDATE OF b NOWAIT`;
    await tx.$queryRaw`SELECT i.id FROM "Invoice" i JOIN "ProgramEnrollment" e ON e."bookingId" = i."bookingId" WHERE e."programId" = ${programId} ORDER BY i.id FOR UPDATE OF i NOWAIT`;
    await tx.$queryRaw`SELECT p.id FROM "Payment" p JOIN "Invoice" i ON i.id = p."invoiceId" JOIN "ProgramEnrollment" e ON e."bookingId" = i."bookingId" WHERE e."programId" = ${programId} ORDER BY p.id FOR UPDATE OF p NOWAIT`;
    const enrollments = await tx.programEnrollment.findMany({ where: { programId }, orderBy: { bookingId: 'asc' }, include: { booking: true } });
    const clients = await tx.client.findMany({ where: { id: { in: enrollments.map(e => e.booking.clientId) } }, select: { id: true, name: true } });
    const bookings = await Promise.all(enrollments.map(async ({ booking }) => ({ ...booking, client: { name: clients.find(c => c.id === booking.clientId)?.name ?? '', firstName: null, lastName: null }, payments: await tx.payment.findMany({
      where: { invoice: { bookingId: booking.id }, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } }, orderBy: { id: 'asc' }, include: { refundRequests: true },
    }) })));
    const preview = buildProgramCancellationPreview({ id: program.id, name: program.nameAr, status: program.status, startDate: program.startDate }, bookings);
    return { program, bookings, preview };
  }

  private async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try { return await this.rlsTransaction.withTransaction(fn); }
    catch (error) {
      const e = error as { code?: string; meta?: { code?: string; driverAdapterError?: { cause?: { originalCode?: string } } } };
      if (e.code === '55P03' || e.code === 'P2034' || e.meta?.code === '55P03' || e.meta?.code === '40P01' || e.meta?.driverAdapterError?.cause?.originalCode === '55P03') throw new ConflictException('Participant changed; refresh cancellation preview');
      throw error;
    }
  }
}
export interface ProgramCancellationResult {
  id: string; status: string; cancelledEnrollments: number; skippedEnrollments: number;
  participants: { bookingId: string; refundAmount: number; currency: string; refundStatus: 'PENDING_REVIEW' | 'PROCESSING' | 'NO_REFUND' }[];
}
