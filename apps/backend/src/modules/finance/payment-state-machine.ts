import { BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';

const VALID_TRANSITIONS: Partial<Record<PaymentStatus, PaymentStatus[]>> = {
  PENDING: ['PENDING_VERIFICATION', 'COMPLETED', 'FAILED'],
  PENDING_VERIFICATION: ['COMPLETED', 'FAILED'],
  // A completed payment can be partially or fully refunded; a partially-refunded
  // payment can take further partial refunds or be refunded in full.
  COMPLETED: ['PARTIALLY_REFUNDED', 'REFUNDED'],
  PARTIALLY_REFUNDED: ['PARTIALLY_REFUNDED', 'REFUNDED'],
  FAILED: ['PENDING'],
  REFUNDED: [],
};

export function assertValidTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new BadRequestException(`Invalid payment status transition: ${from} → ${to}`);
  }
}
