import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { toHalalas } from '../../../finance/money.helper';
import { UpdateSessionPackageDto } from './update-session-package.dto';
import { CreateSessionPackageItemDto } from '../create-session-package/create-session-package.dto';
import { ComputePackagePriceService } from '../../compute-package-price.service';
import {
  buildItemCreateData,
  buildPriceInput,
  validatePackageItems,
} from '../package-constraints.helper';
import { CacheService } from '../../../../infrastructure/cache';
import { PUBLIC_PACKAGES_CACHE_KEY } from '../list-public-packages/public-packages.cache';

export type UpdateSessionPackageCommand = UpdateSessionPackageDto & { packageId: string };

/**
 * Update an existing SessionPackage.
 *
 *   - 404 if the package is missing or already archived.
 *   - If `items` is provided, validate every row (employee-service link,
 *     duration option → service match, paid+free ≥ 1) and replace the
 *     item set atomically inside a transaction (delete + createMany).
 *   - If `discountType` and/or `discountValue` is provided, re-run the
 *     pricing service against the effective items (new if provided, else
 *     the existing persisted items) and validate the discount range.
 *   - Only changed fields are forwarded to Prisma.update.
 */
@Injectable()
export class UpdateSessionPackageHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly pricing: ComputePackagePriceService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: UpdateSessionPackageCommand) {
    const existing = await this.prisma.sessionPackage.findFirst({
      where: { id: dto.packageId, archivedAt: null },
      include: { items: true },
    });
    if (!existing) {
      throw new NotFoundException('Session package not found');
    }

    const itemsProvided = dto.items !== undefined;

    // 1. Validate items + their per-item discounts when a new set is provided.
    let normalized: Awaited<ReturnType<typeof validatePackageItems>> = [];
    if (itemsProvided) {
      normalized = await validatePackageItems(this.prisma, dto.items!);
      const price = await this.pricing.compute({
        items: dto.items!.map((item, i) => buildPriceInput(item, normalized[i])),
      });
      this.validateItemDiscounts(dto.items!, price.lines);
    }

    // 2. Apply the update atomically: replace items if provided, then patch fields.
    //    Package-level discount is deprecated and never written here.
    const updated = await this.rlsTransaction.withTransaction(async (tx) => {
      if (itemsProvided) {
        await tx.sessionPackageItem.deleteMany({ where: { packageId: dto.packageId } });
        // Per-item create (not createMany) to persist each item's constraints.
        for (let idx = 0; idx < dto.items!.length; idx++) {
          await tx.sessionPackageItem.create({
            data: {
              packageId: dto.packageId,
              ...buildItemCreateData(dto.items![idx], normalized[idx], idx),
            },
          });
        }
      }

      return tx.sessionPackage.update({
        where: { id: dto.packageId },
        data: {
          ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
          ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
          ...(dto.descriptionAr !== undefined && { descriptionAr: dto.descriptionAr }),
          ...(dto.descriptionEn !== undefined && { descriptionEn: dto.descriptionEn }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
          ...(dto.iconName !== undefined && { iconName: dto.iconName }),
          ...(dto.iconBgColor !== undefined && { iconBgColor: dto.iconBgColor }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        },
        include: { items: { include: { constraints: { include: { targets: true } } } } },
      });
    });

    await this.cache.invalidatePrefix(PUBLIC_PACKAGES_CACHE_KEY);

    return updated;
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private validateItemDiscounts(
    items: CreateSessionPackageItemDto[],
    lines: { payable: number }[],
  ): void {
    items.forEach((item, i) => {
      if (!item.discountType || !item.discountValue) return;
      if (item.discountType === DiscountType.PERCENTAGE) {
        if (item.discountValue < 0 || item.discountValue > 100) {
          throw new BadRequestException('PERCENTAGE discountValue must be between 0 and 100');
        }
        return;
      }
      const discountHalalas = toHalalas(item.discountValue).toNumber();
      if (discountHalalas > (lines[i]?.payable ?? 0)) {
        throw new BadRequestException("FIXED discountValue must not exceed the item's payable amount");
      }
    });
  }
}