import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { stableEventId } from '../../../common/events';
import { RESERVED_REFUND_STATUSES, type CancellationRefundSummary, type ClientCancellationIntent } from './client-cancellation-policy';

export type PersistedCancellationRefund = Omit<CancellationRefundSummary, 'status'> & {
  status: CancellationRefundSummary['status'] | 'COMPLETED' | 'FAILED';
  completedAmount: number;
  failedAmount: number;
};
@Injectable()
export class ClientCancellationOutcomeHandler {
  constructor(private readonly prisma: PrismaService) {}
  async execute(bookingId: string, clientId: string): Promise<PersistedCancellationRefund | undefined> {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, clientId }, select: { id: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    const log = await this.prisma.bookingStatusLog.findFirst({ where: { bookingId, toStatus: 'CANCELLED' }, orderBy: { createdAt: 'desc' } });
    const stored = log?.sourceActionResult as { refund?: CancellationRefundSummary; cancellationEventId?: string } | null;
    if (!stored?.refund || !stored.cancellationEventId) return undefined;
    const original = stored.refund;
    const event = await this.prisma.outboxEvent.findUnique({ where: { id: stored.cancellationEventId } });
    const intent = (event?.payload as unknown as { payload?: { clientCancellation?: ClientCancellationIntent & { pendingRequestIds?: string[] } } })?.payload?.clientCancellation;
    const payments = await this.prisma.payment.findMany({ where: { invoice: { bookingId, clientId } }, include: { refundRequests: true } });
    const identities = new Set(intent?.allocations.map(p => stableEventId(`${stored.cancellationEventId}:payment:${p.paymentId}`)) ?? []);
    const reservedIds = new Set(intent?.pendingRequestIds ?? []);
    const requests = payments.flatMap(p => p.refundRequests).filter(r => (r.sourceEventId && identities.has(r.sourceEventId)) || reservedIds.has(r.id));
    const target = original.refundAmount + original.pendingRefundAmount;
    const completedAmount = Math.min(target, Math.max(0, payments.reduce((n, p) => n + Number(p.refundedAmount), 0) - original.alreadyRefundedAmount));
    const pendingRefundAmount = requests.filter(r => RESERVED_REFUND_STATUSES.includes(r.status)).reduce((n, r) => n + Number(r.amount), 0);
    const failedAmount = requests.filter(r => ['FAILED', 'DENIED'].includes(r.status)).reduce((n, r) => n + Number(r.amount), 0);
    let status: PersistedCancellationRefund['status'] = original.status;
    if (target > 0 && completedAmount >= target) status = 'COMPLETED';
    else if (failedAmount > 0) status = 'FAILED';
    else if (requests.some(r => ['PENDING_REVIEW', 'MANUAL_REVIEW'].includes(r.status))) status = 'PENDING_REVIEW';
    else if (requests.some(r => ['PROCESSING', 'APPROVED'].includes(r.status))) status = 'PROCESSING';
    return { ...original, status, pendingRefundAmount, completedAmount, failedAmount };
  }
}
