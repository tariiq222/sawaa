import { Injectable } from '@nestjs/common';
import { DiscountType } from '@prisma/client';

// Money is integer halalas — round to whole halalas.
function roundHalalas(n: number): number {
  return Math.round(n);
}

export interface ComputeBundlePriceParams {
  servicePrices: number[];
  discountType: DiscountType;
  discountValue: number;
}

export interface BundlePriceResult {
  subtotal: number;
  discountAmount: number;
  finalPrice: number;
}

@Injectable()
export class BundlePriceService {
  computeBundlePrice(params: ComputeBundlePriceParams): BundlePriceResult {
    const { servicePrices, discountType, discountValue } = params;

    const subtotal = roundHalalas(servicePrices.reduce((sum, p) => sum + p, 0));

    let discountAmount: number;
    if (discountType === DiscountType.PERCENTAGE) {
      const cappedPct = Math.min(discountValue, 100);
      // cappedPct is a 0-100 percentage — the / 100 here is the percentage divisor.
      discountAmount = roundHalalas(subtotal * cappedPct / 100);
    } else {
      // FIXED
      discountAmount = roundHalalas(Math.min(discountValue, subtotal));
    }

    const finalPrice = roundHalalas(Math.max(0, subtotal - discountAmount));

    return { subtotal, discountAmount, finalPrice };
  }
}
