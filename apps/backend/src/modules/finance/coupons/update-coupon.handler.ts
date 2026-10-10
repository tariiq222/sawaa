import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateCouponDto } from './update-coupon.dto';
import type { DiscountType } from '@prisma/client';

export type UpdateCouponCommand = UpdateCouponDto & { couponId: string };

@Injectable()
export class UpdateCouponHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: UpdateCouponCommand) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: cmd.couponId },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');

    if (cmd.discountType && cmd.discountType !== coupon.discountType) throw new BadRequestException("Coupon discount type cannot be changed");
    if ((cmd.discountType ?? coupon.discountType) === "PERCENTAGE" && (cmd.discountValue ?? Number(coupon.discountValue)) > 100) throw new BadRequestException("Percentage discount cannot exceed 100");
    const { couponId: _c, discountType, expiresAt, ...rest } = cmd;
    return this.prisma.coupon.update({
      where: { id: cmd.couponId },
      data: {
        ...rest,
        ...(discountType && { discountType: discountType as DiscountType }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt === null ? null : new Date(expiresAt) }),
      },
    });
  }
}
