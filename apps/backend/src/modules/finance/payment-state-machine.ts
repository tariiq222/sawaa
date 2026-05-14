import { BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';

export const VALID_TRANSITIONS: Partial<Record<PaymentStatus, PaymentStatus[]>> = {
  PENDING: ['PENDING_VERIFICATION', 'COMPLETED', 'FAILED'],
  PENDING_VERIFICATION: ['COMPLETED', 'FAILED'],
  COMPLETED: ['REFUNDED'],
  FAILED: ['PENDING'],
  REFUNDED: [],
};

export function assertValidTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new BadRequestException(`Invalid payment status transition: ${from} → ${to}`);
  }
}
