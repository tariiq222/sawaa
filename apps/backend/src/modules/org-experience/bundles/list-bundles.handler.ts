import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { BundlePriceService } from './bundle-price.service';
import { ListBundlesDto } from './list-bundles.dto';

export type ListBundlesCommand = ListBundlesDto;

@Injectable()
export class ListBundlesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bundlePrice: BundlePriceService,
  ) {}

  async execute(dto: ListBundlesCommand) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      archivedAt: null,
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.includeHidden !== true && { isHidden: false }),
      ...(dto.search && {
        OR: [
          { nameAr: { contains: dto.search, mode: 'insensitive' as const } },
          { nameEn: { contains: dto.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [rawItems, total] = await Promise.all([
      this.prisma.serviceBundle.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          items: {
            include: { service: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      }),
      this.prisma.serviceBundle.count({ where }),
    ]);

    const items = rawItems.map((bundle) => {
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
    });

    return toListResponse(items, total, page, limit);
  }
}
