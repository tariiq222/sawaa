import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export interface DeleteCouponCommand { couponId: string; }

@Injectable()
export class DeleteCouponHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: DeleteCouponCommand): Promise<void> {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const [coupon, redemptionCount] = await Promise.all([
      this.prisma.coupon.findFirst({ where: { id: cmd.couponId, organizationId } }),
      this.prisma.couponRedemption.count({ where: { couponId: cmd.couponId, organizationId } }),
    ]);
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (redemptionCount > 0) {
      throw new BadRequestException('Cannot delete coupon with existing redemptions');
    }
    await this.prisma.coupon.delete({ where: { id: cmd.couponId, organizationId } });
  }
}
