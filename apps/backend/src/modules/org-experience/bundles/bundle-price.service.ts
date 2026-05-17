import { Injectable } from '@nestjs/common';
import { DiscountType } from '@prisma/client';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

    const subtotal = round2(servicePrices.reduce((sum, p) => sum + p, 0));

    let discountAmount: number;
    if (discountType === DiscountType.PERCENTAGE) {
      const cappedPct = Math.min(discountValue, 100);
      discountAmount = round2(subtotal * cappedPct / 100);
    } else {
      // FIXED
      discountAmount = round2(Math.min(discountValue, subtotal));
    }

    const finalPrice = round2(Math.max(0, subtotal - discountAmount));

    return { subtotal, discountAmount, finalPrice };
  }
}
