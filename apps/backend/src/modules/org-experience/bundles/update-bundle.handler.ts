import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { DiscountType } from '@prisma/client';
import { BundlePriceService } from './bundle-price.service';
import { UpdateBundleDto } from './update-bundle.dto';

export type UpdateBundleCommand = { bundleId: string } & UpdateBundleDto;

@Injectable()
export class UpdateBundleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly bundlePrice: BundlePriceService,
  ) {}

  async execute(dto: UpdateBundleCommand) {
    const { bundleId, ...updateData } = dto;

    // 1. Fetch existing bundle
    const bundle = await this.prisma.serviceBundle.findFirst({
      where: { id: bundleId, archivedAt: null },
      include: {
        items: {
          include: { service: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!bundle) throw new NotFoundException('Bundle not found');

    // 2. Check nameAr uniqueness if changed
    if (updateData.nameAr && updateData.nameAr !== bundle.nameAr) {
      const conflict = await this.prisma.serviceBundle.findFirst({
        where: { nameAr: updateData.nameAr, archivedAt: null, id: { not: bundleId } },
      });
      if (conflict) {
        throw new ConflictException('Bundle with this Arabic name already exists');
      }
    }

    // Determine final discount type and value for validation
    const finalDiscountType = updateData.discountType ?? bundle.discountType;
    const finalDiscountValue = updateData.discountValue !== undefined
      ? updateData.discountValue
      : Number(bundle.discountValue);

    let priceResult: { subtotal: number; discountAmount: number; finalPrice: number } | undefined;

    const updatedBundle = await this.rlsTransaction.withTransaction(async (tx) => {
      // 3. If serviceIds provided, re-validate services
      let serviceIds: string[] | undefined = updateData.serviceIds;
      if (serviceIds) {
        const services = await tx.service.findMany({
          where: { id: { in: serviceIds }, archivedAt: null },
        });

        if (services.length !== serviceIds.length) {
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

        // Re-validate discount against new subtotal
        const servicePrices = services.map((s) => Number(s.price));
        priceResult = this.bundlePrice.computeBundlePrice({
          servicePrices,
          discountType: finalDiscountType,
          discountValue: finalDiscountValue,
        });

        if (finalDiscountType === DiscountType.FIXED && finalDiscountValue > priceResult.subtotal) {
          throw new BadRequestException('Discount exceeds bundle subtotal');
        }

        if (finalDiscountType === DiscountType.PERCENTAGE && finalDiscountValue > 100) {
          throw new BadRequestException('Percentage discount cannot exceed 100');
        }

        // Replace items
        await tx.serviceBundleItem.deleteMany({ where: { bundleId } });
        await tx.serviceBundleItem.createMany({
          data: serviceIds.map((serviceId, index) => ({
            bundleId,
            serviceId,
            sortOrder: index,
          })),
        });
      } else {
        // Compute price with existing services
        const existingServicePrices = bundle.items.map((item) => Number(item.service.price));
        priceResult = this.bundlePrice.computeBundlePrice({
          servicePrices: existingServicePrices,
          discountType: finalDiscountType,
          discountValue: finalDiscountValue,
        });

        if (finalDiscountType === DiscountType.FIXED && finalDiscountValue > priceResult.subtotal) {
          throw new BadRequestException('Discount exceeds bundle subtotal');
        }

        if (finalDiscountType === DiscountType.PERCENTAGE && finalDiscountValue > 100) {
          throw new BadRequestException('Percentage discount cannot exceed 100');
        }
      }

      // 4. Update bundle fields
      await tx.serviceBundle.update({
        where: { id: bundleId },
        data: {
          ...(updateData.nameAr !== undefined && { nameAr: updateData.nameAr }),
          ...(updateData.nameEn !== undefined && { nameEn: updateData.nameEn }),
          ...(updateData.descriptionAr !== undefined && { descriptionAr: updateData.descriptionAr }),
          ...(updateData.descriptionEn !== undefined && { descriptionEn: updateData.descriptionEn }),
          ...(updateData.imageUrl !== undefined && { imageUrl: updateData.imageUrl }),
          ...(updateData.iconName !== undefined && { iconName: updateData.iconName }),
          ...(updateData.iconBgColor !== undefined && { iconBgColor: updateData.iconBgColor }),
          ...(updateData.discountType !== undefined && { discountType: updateData.discountType }),
          ...(updateData.discountValue !== undefined && { discountValue: updateData.discountValue }),
          ...(updateData.currency !== undefined && { currency: updateData.currency }),
          ...(updateData.isActive !== undefined && { isActive: updateData.isActive }),
          ...(updateData.isHidden !== undefined && { isHidden: updateData.isHidden }),
          ...(updateData.sortOrder !== undefined && { sortOrder: updateData.sortOrder }),
        },
      });

      return tx.serviceBundle.findFirstOrThrow({
        where: { id: bundleId },
        include: {
          items: {
            include: { service: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    });

    return {
      ...updatedBundle,
      subtotal: priceResult!.subtotal,
      discountAmount: priceResult!.discountAmount,
      finalPrice: priceResult!.finalPrice,
    };
  }
}
