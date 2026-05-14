import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

export interface GetCouponQuery { couponId: string; }

@Injectable()
export class GetCouponHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(query: GetCouponQuery) {
    const coupon = await this.prisma.coupon.findFirst({
      where: { id: query.couponId },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }
}
