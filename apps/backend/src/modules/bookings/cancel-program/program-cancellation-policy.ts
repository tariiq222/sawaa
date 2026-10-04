import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { CancellationPayment } from '../client/client-cancellation-policy';
import { buildStaffCancellationIntent } from '../../finance/cancellation-refund/staff-cancellation-refund';

export interface ProgramCancellationParticipant {
  bookingId: string; clientId: string; clientName: string; bookingNumber: number; status: string; currency: string;
  paidAmount: number; alreadyRefundedAmount: number; pendingRefundAmount: number; maxRefundAmount: number; refundAmount: number | null;
}
export interface ProgramCancellationPreview {
  programId: string; hasStarted: boolean; quoteToken: string; participants: ProgramCancellationParticipant[];
}
export interface ProgramCancellationBooking {
  id: string; clientId: string; client: { firstName: string | null; lastName: string | null; name?: string }; bookingNumber: number;
  status: string; checkedInAt: Date | null; isHistoricalImport: boolean; currency: string; payments: CancellationPayment[];
}
export function buildProgramCancellationPreview(
  program: { id: string; name: string; status: string; startDate: Date | null }, bookings: ProgramCancellationBooking[], now = new Date(),
): ProgramCancellationPreview {
  const sorted = [...bookings].sort((a, b) => a.id.localeCompare(b.id));
  const hasStarted = !!(program.startDate && program.startDate <= now) || sorted.some(b => b.checkedInAt || b.status === 'COMPLETED' || b.isHistoricalImport);
  const participants = sorted.map(b => {
    const { refund } = buildStaffCancellationIntent({ payments: b.payments, currency: b.currency, initiatedBy: 'CENTER', reason: '', performedBy: '', automatic: true });
    return { bookingId: b.id, clientId: b.clientId, clientName: b.client.name ?? `${b.client.firstName ?? ''} ${b.client.lastName ?? ''}`.trim(), bookingNumber: b.bookingNumber, status: b.status, currency: b.currency,
      paidAmount: refund.paidAmount, alreadyRefundedAmount: refund.alreadyRefundedAmount, pendingRefundAmount: refund.pendingRefundAmount, maxRefundAmount: b.isHistoricalImport ? 0 : refund.refundAmount, refundAmount: hasStarted ? null : b.isHistoricalImport ? 0 : refund.refundAmount };
  });
  const quoteToken = createHash('sha256').update(JSON.stringify({ program, hasStarted, participants,
    bookings: sorted.map(b => ({ id: b.id, checkedInAt: b.checkedInAt, isHistoricalImport: b.isHistoricalImport,
      payments: [...b.payments].sort((a, z) => a.id.localeCompare(z.id)).map(p => ({ ...p, refundRequests: [...p.refundRequests].sort((a, z) => a.id.localeCompare(z.id)) })) })) })).digest('hex');
  return { programId: program.id, hasStarted, participants, quoteToken };
}
export function resolveProgramRefunds(preview: ProgramCancellationPreview, refunds?: { bookingId: string; amount: number }[]): Map<string, number> {
  if (!preview.hasStarted) {
    if (refunds?.length) throw new BadRequestException('Before start, the full available amount is refunded');
    return new Map(preview.participants.map(p => [p.bookingId, p.maxRefundAmount]));
  }
  const result = new Map<string, number>();
  for (const refund of refunds ?? []) {
    const participant = preview.participants.find(p => p.bookingId === refund.bookingId);
    if (!participant || result.has(refund.bookingId) || !Number.isSafeInteger(refund.amount) || refund.amount < 0 || refund.amount > participant.maxRefundAmount) throw new BadRequestException('Invalid participant refund amount');
    result.set(refund.bookingId, refund.amount);
  }
  for (const p of preview.participants) {
    if (p.paidAmount > 0 && !result.has(p.bookingId)) throw new BadRequestException('Specify a refund amount for every paid participant');
    if (!result.has(p.bookingId)) result.set(p.bookingId, 0);
  }
  return result;
}
