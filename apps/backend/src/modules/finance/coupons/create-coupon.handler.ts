import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { CreateCouponDto } from './create-coupon.dto';
import type { DiscountType } from '@prisma/client';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type CreateCouponCommand = CreateCouponDto;

@Injectable()
export class CreateCouponHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: CreateCouponCommand) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
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
