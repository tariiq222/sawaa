import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateCouponDto } from './create-coupon.dto';
import type { DiscountType } from '@prisma/client';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export type CreateCouponCommand = CreateCouponDto;

@Injectable()
export class CreateCouponHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: CreateCouponCommand) {
    const _organizationId = DEFAULT_ORG_ID;
    if (cmd.discountType === "PERCENTAGE" && cmd.discountValue > 100) throw new BadRequestException("Percentage discount cannot exceed 100");
    const exists = await this.prisma.coupon.findFirst({
      where: { code: cmd.code },
    });
    if (exists) throw new ConflictException(`Coupon code '${cmd.code}' already exists`);

    return this.prisma.coupon.create({
      data: {
        code: cmd.code,
        descriptionAr: cmd.descriptionAr,
        descriptionEn: cmd.descriptionEn,
        discountType: cmd.discountType as DiscountType,
        discountValue: cmd.discountValue,
        minOrderAmt: cmd.minOrderAmt,
        maxUses: cmd.maxUses,
        maxUsesPerUser: cmd.maxUsesPerUser,
        serviceIds: cmd.serviceIds ?? [],
        expiresAt: cmd.expiresAt ? new Date(cmd.expiresAt) : undefined,
        isActive: cmd.isActive ?? true,
      },
    });
  }
}
