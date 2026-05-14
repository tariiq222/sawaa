import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';

import { ApplyCouponDto } from './apply-coupon.dto';

export type ApplyCouponCommand = ApplyCouponDto;

@Injectable()
export class ApplyCouponHandler {
  private readonly logger = new Logger(ApplyCouponHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTx: RlsTransactionService,
  ) {}

  async execute(cmd: ApplyCouponCommand) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: cmd.invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${cmd.invoiceId} not found`);
    }

    const coupon = await this.prisma.coupon.findFirst({
      where: { code: cmd.code },
    });
    if (!coupon || !coupon.isActive) throw new NotFoundException(`Coupon ${cmd.code} not found`);
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException(`Coupon ${cmd.code} has expired`);
    }
    if (coupon.minOrderAmt !== null && Number(invoice.subtotal) < Number(coupon.minOrderAmt)) {
      throw new BadRequestException(`Order total does not meet minimum for coupon ${cmd.code}`);
    }

    const existing = await this.prisma.couponRedemption.findUnique({
      where: { couponId_invoiceId: { couponId: coupon.id, invoiceId: cmd.invoiceId } },
    });
    if (existing) throw new BadRequestException(`Coupon already applied to this invoice`);

    const invoiceSubtotal = new Prisma.Decimal(invoice.subtotal.toString());
    const invoiceDiscountAmt = new Prisma.Decimal(invoice.discountAmt.toString());
    const invoiceVatRate = new Prisma.Decimal(invoice.vatRate.toString());
    const couponDiscountValue = new Prisma.Decimal(coupon.discountValue.toString());

    const discount =
      coupon.discountType === 'PERCENTAGE'
        ? invoiceSubtotal.times(couponDiscountValue).div(100).toDecimalPlaces(2).toNumber()
        : Prisma.Decimal.min(couponDiscountValue, invoiceSubtotal).toNumber();

    const discountDecimal = new Prisma.Decimal(discount);
    const newDiscountAmt = invoiceDiscountAmt.plus(discountDecimal).toDecimalPlaces(2).toNumber();
    const newDiscountAmtDec = new Prisma.Decimal(newDiscountAmt);
    const newVatBase = Prisma.Decimal.max(invoiceSubtotal.minus(newDiscountAmtDec), new Prisma.Decimal(0));
    const newVatAmt = newVatBase.times(invoiceVatRate).toDecimalPlaces(2).toNumber();
    const newTotal = newVatBase.plus(newVatAmt).toDecimalPlaces(2).toNumber();

    return this.rlsTx.withTransaction(async (tx) => {
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
          where: { couponId: coupon.id, clientId: cmd.clientId },
        });
        if (userRedemptionCount >= coupon.maxUsesPerUser) {
          throw new BadRequestException(
            `Coupon ${cmd.code} has reached its per-user limit of ${coupon.maxUsesPerUser} uses`,
          );
        }
      }

      const redemption = await tx.couponRedemption.create({
        data: { couponId: coupon.id, invoiceId: cmd.invoiceId, clientId: cmd.clientId, discount },
      });

      await tx.invoice.update({
        where: { id: cmd.invoiceId },
        data: { discountAmt: newDiscountAmt, vatAmt: newVatAmt, total: newTotal },
      });

      return redemption;
    });
  }
}
