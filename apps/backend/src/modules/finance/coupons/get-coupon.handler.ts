import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { parseEntityRef } from '../../../common/parse-entity-ref';

export interface GetCouponQuery { couponId: string; }

@Injectable()
export class GetCouponHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetCouponQuery) {
    const idf = parseEntityRef(query.couponId, 'CPN');
    const coupon = await this.prisma.coupon.findFirst({
      where: idf.kind === 'uuid' ? { id: idf.id } : { ref: idf.ref },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }
}
