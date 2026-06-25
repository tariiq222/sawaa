import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';

import { ApplyCouponDto } from './apply-coupon.dto';

export type ApplyCouponCommand = ApplyCouponDto & {
  /**
   * SECURITY (P0-8): when set, the invoice's client MUST equal this id.
   * Mobile/website client surfaces inject the JWT subject here; dashboard
   * staff omit it (CASL guards the endpoint).
   */
  callerClientId?: string;
};

@Injectable()
export class ApplyCouponHandler {
  private readonly logger = new Logger(ApplyCouponHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: ApplyCouponCommand) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: cmd.invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${cmd.invoiceId} not found`);
    }

    // SECURITY (P0-8): the redeeming client is ALWAYS the invoice owner.
    // Caller-supplied clientId is gone. For client surfaces, also verify the
    // caller actually owns the invoice.
    if (cmd.callerClientId && invoice.clientId !== cmd.callerClientId) {
      throw new ForbiddenException('Invoice does not belong to caller');
    }
    const redeemingClientId = invoice.clientId;

    const coupon = await this.prisma.coupon.findFirst({
      where: { code: cmd.code },
    });
    if (!coupon || !coupon.isActive) throw new NotFoundException(`Coupon ${cmd.code} not found`);
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException(`Coupon ${cmd.code} has expired`);
    }
    // SECURITY (P1): defense-in-depth against legacy/migrated rows that may
    // pre-date the DTO Min/Max validators (P0-8 era). Refuse negative or
    // out-of-range coupons rather than letting them flip the invoice math.
    const couponValueNum = Number(coupon.discountValue);
    if (couponValueNum < 0) {
      throw new BadRequestException(`Coupon ${cmd.code} has an invalid discountValue`);
    }
    if (coupon.discountType === 'PERCENTAGE' && couponValueNum > 100) {
      throw new BadRequestException(`Coupon ${cmd.code} has an invalid percentage value`);
    }
    if (coupon.minOrderAmt !== null && Number(invoice.subtotal) < Number(coupon.minOrderAmt)) {
      throw new BadRequestException(`Order total does not meet minimum for coupon ${cmd.code}`);
    }

    // FIN-002 (P0): Coupon.serviceIds is the per-service whitelist persisted
    // at coupon creation. It was stored but never enforced here, so a
    // service-restricted coupon could be redeemed on any invoice. The booking
    // path (validate-coupon.service.ts) already does this check; apply-coupon
    // must agree or the dashboard's per-service targeting is bypassed.
    if (coupon.serviceIds.length > 0) {
      if (invoice.packagePurchaseId) {
        // Package-backed invoice: no single serviceId (a package spans multiple
        // services). Refuse service-restricted coupons rather than guessing.
        throw new BadRequestException(
          `Coupon ${cmd.code} is restricted to specific services and cannot be applied to a package purchase`,
        );
      }
      if (!invoice.bookingId) {
        throw new BadRequestException(
          `Coupon ${cmd.code} is restricted to specific services and requires a booking-backed invoice`,
        );
      }
      const booking = await this.prisma.booking.findFirst({
        where: { id: invoice.bookingId },
        select: { serviceId: true },
      });
      if (!booking || booking.serviceId == null || !coupon.serviceIds.includes(booking.serviceId)) {
        throw new BadRequestException(
          `Coupon ${cmd.code} is not eligible for this service`,
        );
      }
    }

    const existing = await this.prisma.couponRedemption.findUnique({
      where: { couponId_invoiceId: { couponId: coupon.id, invoiceId: cmd.invoiceId } },
    });
    if (existing) throw new BadRequestException(`Coupon already applied to this invoice`);

    const invoiceSubtotal = new Prisma.Decimal(invoice.subtotal.toString());
    const invoiceDiscountAmt = new Prisma.Decimal(invoice.discountAmt.toString());
    const invoiceVatRate = new Prisma.Decimal(invoice.vatRate.toString());
    const couponDiscountValue = new Prisma.Decimal(coupon.discountValue.toString());

    // All amounts are integer halalas — use toDecimalPlaces(0, ROUND_HALF_UP) for every rounding step.
    const discountDecimal: Prisma.Decimal =
      coupon.discountType === 'PERCENTAGE'
        ? invoiceSubtotal
            .times(couponDiscountValue)
            .div(100)
            .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
        : Prisma.Decimal.min(couponDiscountValue, invoiceSubtotal);

    // Invariant: discountDecimal + newSubtotal === invoiceSubtotal (no halala lost/gained).
    const newDiscountAmtDec = invoiceDiscountAmt
      .plus(discountDecimal)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
    const newVatBase = Prisma.Decimal.max(invoiceSubtotal.minus(newDiscountAmtDec), new Prisma.Decimal(0));
    const newVatAmt = newVatBase.times(invoiceVatRate).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
    const newTotal = newVatBase.plus(newVatAmt).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);

    // Convert to number only at the boundary for Prisma writes.
    const discountHalalas = discountDecimal.toNumber();

    return this.rlsTransaction.withTransaction(async (tx) => {
      if (coupon.maxUses !== null) {
        const { count } = await tx.coupon.updateMany({
          where: { id: coupon.id, usedCount: { lt: coupon.maxUses } },
          data: { usedCount: { increment: 1 } },
        });
        if (count === 0) throw new BadRequestException(`Coupon ${cmd.code} has reached its usage limit`);
      } else {
        const owned = await tx.coupon.findFirst({ where: { id: coupon.id } });
        if (!owned) throw new NotFoundException(`Coupon ${cmd.code} not found`);
        await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
      }

      if (coupon.maxUsesPerUser !== null) {
        const userRedemptionCount = await tx.couponRedemption.count({
          where: { couponId: coupon.id, clientId: redeemingClientId },
        });
        if (userRedemptionCount >= coupon.maxUsesPerUser) {
          throw new BadRequestException(
            `Coupon ${cmd.code} has reached its per-user limit of ${coupon.maxUsesPerUser} uses`,
          );
        }
      }

      const redemption = await tx.couponRedemption.create({
        data: { couponId: coupon.id, invoiceId: cmd.invoiceId, clientId: redeemingClientId, discount: discountHalalas },
      });

      await tx.invoice.update({
        where: { id: cmd.invoiceId },
        data: {
          discountAmt: newDiscountAmtDec.toNumber(),
          vatAmt: newVatAmt.toNumber(),
          total: newTotal.toNumber(),
        },
      });

      return redemption;
    });
  }
}
