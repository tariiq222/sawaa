import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { UpdateCouponDto } from './update-coupon.dto';
import type { DiscountType } from '@prisma/client';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type UpdateCouponCommand = UpdateCouponDto & { couponId: string };

@Injectable()
export class UpdateCouponHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: UpdateCouponCommand) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: cmd.couponId, organizationId },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');

    const { couponId: _c, discountType, expiresAt, ...rest } = cmd;
    return this.prisma.coupon.update({
      where: { id: cmd.couponId, organizationId },
      data: {
        ...rest,
        ...(discountType && { discountType: discountType as DiscountType }),
        ...(expiresAt && { expiresAt: new Date(expiresAt) }),
      },
    });
  }
}
