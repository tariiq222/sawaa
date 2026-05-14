import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export interface GetCouponQuery { couponId: string; }

@Injectable()
export class GetCouponHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(query: GetCouponQuery) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: query.couponId, organizationId },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }
}
