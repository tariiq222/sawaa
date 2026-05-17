import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { BundlePriceService } from './bundle-price.service';

export type GetBundleCommand = { bundleId: string };

@Injectable()
export class GetBundleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bundlePrice: BundlePriceService,
  ) {}

  async execute(dto: GetBundleCommand) {
    const bundle = await this.prisma.serviceBundle.findFirst({
      where: { id: dto.bundleId, archivedAt: null },
      include: {
        items: {
          include: { service: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!bundle) throw new NotFoundException('Bundle not found');

    const servicePrices = bundle.items.map((item) => Number(item.service.price));
    const priceResult = this.bundlePrice.computeBundlePrice({
      servicePrices,
      discountType: bundle.discountType,
      discountValue: Number(bundle.discountValue),
    });

    return {
      ...bundle,
      subtotal: priceResult.subtotal,
      discountAmount: priceResult.discountAmount,
      finalPrice: priceResult.finalPrice,
    };
  }
}
