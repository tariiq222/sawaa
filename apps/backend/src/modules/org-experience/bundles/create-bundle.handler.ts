import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { DiscountType } from '@prisma/client';
import { BundlePriceService } from './bundle-price.service';
import { CreateBundleDto } from './create-bundle.dto';

export type CreateBundleCommand = CreateBundleDto;

@Injectable()
export class CreateBundleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bundlePrice: BundlePriceService,
  ) {}

  async execute(dto: CreateBundleCommand) {
    // 1. Check nameAr uniqueness among non-archived bundles
    const existing = await this.prisma.serviceBundle.findFirst({
      where: { nameAr: dto.nameAr, archivedAt: null },
    });
    if (existing) {
      throw new ConflictException('Bundle with this Arabic name already exists');
    }

    // 2. Fetch and validate services
    const services = await this.prisma.service.findMany({
      where: { id: { in: dto.serviceIds }, archivedAt: null },
    });

    if (services.length !== dto.serviceIds.length) {
      throw new BadRequestException('One or more services not found or archived');
    }

    const hasInactiveService = services.some((s) => !s.isActive);
    if (hasInactiveService) {
      throw new BadRequestException('All bundle services must be active');
    }

    const currencies = new Set(services.map((s) => s.currency));
    if (currencies.size > 1) {
      throw new BadRequestException('All bundle services must share the same currency');
    }

    // 3. Compute price
    const servicePrices = services.map((s) => Number(s.price));
    const priceResult = this.bundlePrice.computeBundlePrice({
      servicePrices,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
    });

    if (dto.discountType === DiscountType.FIXED && dto.discountValue > priceResult.subtotal) {
      throw new BadRequestException('Discount exceeds bundle subtotal');
    }

    if (dto.discountType === DiscountType.PERCENTAGE && dto.discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    const bundleCurrency = dto.currency ?? services[0].currency ?? 'SAR';

    // 4. Create bundle and items in a transaction
    const bundle = await this.prisma.$transaction(async (tx) => {
      const created = await tx.serviceBundle.create({
        data: {
          nameAr: dto.nameAr,
          nameEn: dto.nameEn,
          descriptionAr: dto.descriptionAr,
          descriptionEn: dto.descriptionEn,
          imageUrl: dto.imageUrl,
          iconName: dto.iconName,
          iconBgColor: dto.iconBgColor,
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          currency: bundleCurrency,
          isActive: dto.isActive ?? true,
          isHidden: dto.isHidden ?? false,
          sortOrder: dto.sortOrder ?? 0,
        },
      });

      await tx.serviceBundleItem.createMany({
        data: dto.serviceIds.map((serviceId, index) => ({
          bundleId: created.id,
          serviceId,
          sortOrder: index,
        })),
      });

      return tx.serviceBundle.findFirstOrThrow({
        where: { id: created.id },
        include: {
          items: {
            include: { service: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    });

    // 5. Return bundle enriched with computed price
    return {
      ...bundle,
      subtotal: priceResult.subtotal,
      discountAmount: priceResult.discountAmount,
      finalPrice: priceResult.finalPrice,
    };
  }
}
