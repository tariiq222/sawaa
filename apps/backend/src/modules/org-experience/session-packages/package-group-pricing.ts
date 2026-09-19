import { BadRequestException } from '@nestjs/common';
import { calculateGroupedSessionNet } from '@sawaa/shared/money';
import type { GlobalDiscount } from '@sawaa/shared/types';

export type { GlobalDiscount } from '@sawaa/shared/types';

export type SessionNetAllocation = ReturnType<typeof calculateGroupedSessionNet>;

/**
 * Backend compatibility wrapper for the framework-agnostic shared helper.
 * Existing callers keep receiving Nest's BadRequestException at this boundary.
 */
export function allocateSessionNet(
  prices: number[],
  discount: GlobalDiscount,
): SessionNetAllocation {
  try {
    return calculateGroupedSessionNet(prices, discount);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}
