import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { DiscountType, Prisma } from '@prisma/client';
import { toHalalas } from '../../../finance/money.helper';
import { CreateSessionPackageDto } from './create-session-package.dto';
import { ComputePackagePriceService } from '../../compute-package-price.service';
import {
  buildItemCreateData,
  buildPriceInput,
  validatePackageItems,
} from '../package-constraints.helper';
import { CacheService } from '../../../../infrastructure/cache';
import { PUBLIC_PACKAGES_CACHE_KEY } from '../list-public-packages/public-packages.cache';

export type CreateSessionPackageCommand = CreateSessionPackageDto;

/**
 * Create a new SessionPackage + its items atomically.
 *
 * Validation pipeline (each step fails fast with 400 + Arabic error):
 *  1. Each item's `EmployeeService` link must exist (employee offers service).
 *  2. Each item's `ServiceDurationOption` must belong to the same serviceId.
 *  3. Each item must have paidQuantity + freeQuantity >= 1 (catches {0,0} bug).
 *  4. discountValue range: PERCENTAGE → [0,100]; FIXED → ≤ computed subtotal.
 *  5. Compute final price with the shared pricing service (sanity check + UI preview).
 *  6. Convert FIXED discountValue from SAR float to integer halalas via toHalalas.
 *  7. Persist package + items inside a single transaction (RLS-scoped).
 */
@Injectable()
export class CreateSessionPackageHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly pricing: ComputePackagePriceService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: CreateSessionPackageCommand) {
    // Normalise + validate items (constraints or legacy triple, existence, links).
    const normalized = await validatePackageItems(this.prisma, dto.items);

    // Compute per-item prices (discount lives on each item now) and validate
    // every item's discount against its own payable amount.
    const price = await this.pricing.compute({
      items: dto.items.map((item, i) => buildPriceInput(item, normalized[i])),
    });
    this.validateItemDiscounts(dto.items, price.lines);

    const created = await this.rlsTransaction.withTransaction((tx) =>
      tx.sessionPackage.create({
        data: {
          nameAr: dto.nameAr,
          nameEn: dto.nameEn ?? null,
          descriptionAr: dto.descriptionAr ?? null,
          descriptionEn: dto.descriptionEn ?? null,
          imageUrl: dto.imageUrl ?? null,
          iconName: dto.iconName ?? null,
          iconBgColor: dto.iconBgColor ?? null,
          // Package-level discount is deprecated — store a neutral value.
          // The effective discount now lives on each item.
          discountType: DiscountType.PERCENTAGE,
          discountValue: 0 as unknown as Prisma.Decimal,
          isActive: dto.isActive ?? true,
          isPublic: dto.isPublic ?? false,
          sortOrder: dto.sortOrder ?? 0,
          items: {
            // Nested create (not createMany) to persist each item's constraints.
            create: dto.items.map((item, idx) =>
              buildItemCreateData(item, normalized[idx], idx),
            ),
          },
        },
        include: { items: { include: { constraints: { include: { targets: true } } } } },
      }),
    );

    await this.cache.invalidatePrefix(PUBLIC_PACKAGES_CACHE_KEY);

    return created;
  }

  /**
   * Per-item discount validation against the computed lines (same order as items):
   *   PERCENTAGE → reject values outside [0,100].
   *   FIXED      → reject halalas amounts that exceed the item's payable (paid × unit).
   */
  private validateItemDiscounts(
    items: CreateSessionPackageDto['items'],
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