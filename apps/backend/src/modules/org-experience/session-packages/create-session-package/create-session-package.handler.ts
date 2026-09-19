import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { DiscountType, Prisma } from '@prisma/client';
import { toHalalas } from '../../../finance/money.helper';
import { CreateSessionPackageDto } from './create-session-package.dto';
import { ComputePackagePriceService } from '../../compute-package-price.service';
import {
  buildItemCreateData,
  buildPriceInput,
} from '../package-constraints.helper';
import { validatePackageItemsForOwner } from '../package-owner.helper';
import { CacheService } from '../../../../infrastructure/cache';
import { PUBLIC_PACKAGES_CACHE_KEY } from '../list-public-packages/public-packages.cache';
import { allocateSessionNet } from '../package-group-pricing';
import { resolvePackageGroupOfferings, validateGroupedPackageStorageBounds } from '../package-group-offering.helper';
import type { CreatedGroupedCatalogPackage } from '../package-group-catalog.helper';
import { PriceResolverService } from '../../services/price-resolver.service';
import { randomUUID } from 'node:crypto';
import type { GlobalDiscount } from '@sawaa/shared/types';
import type { PackageGroupInputLike } from '../package-group-offering.helper';

type GroupedWriteTransaction = {
  sessionPackage: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    findUnique(args: unknown): Promise<CreatedGroupedCatalogPackage>;
  };
  sessionPackageGroup: {
    createMany(args: { data: Record<string, unknown>[] }): Promise<unknown>;
  };
  sessionPackageItem: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

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
    @Optional() private readonly priceResolver?: PriceResolverService,
  ) {}

  async execute(dto: CreateSessionPackageCommand) {
    if (dto.modelVersion === 'GROUPED_V2') {
      return this.createGrouped(dto);
    }
    if (dto.groups !== undefined || dto.globalDiscount !== undefined) {
      throw new BadRequestException('LEGACY packages cannot include GROUPED_V2 groups or globalDiscount');
    }
    const legacyItems = dto.items;
    if (!legacyItems) {
      throw new BadRequestException('Legacy packages require at least one item');
    }

    // Normalise + validate items (constraints or legacy triple, existence, links).
    const normalized = await validatePackageItemsForOwner(this.prisma, legacyItems, dto.ownerEmployeeId);

    // Compute per-item prices (discount lives on each item now) and validate
    // every item's discount against its own payable amount.
    const price = await this.pricing.compute({
      items: legacyItems.map((item, i) => buildPriceInput(item, normalized[i])),
    });
    this.validateItemDiscounts(legacyItems, price.lines);

    const created = await this.rlsTransaction.withTransaction((tx) =>
      tx.sessionPackage.create({
        data: {
          ownerEmployeeId: dto.ownerEmployeeId ?? null,
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
            create: legacyItems.map((item, idx) =>
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

  private async createGrouped(dto: CreateSessionPackageCommand) {
    const hasValue = (key: keyof CreateSessionPackageCommand) => dto[key] !== undefined;
    if (dto.ownerEmployeeId != null || hasValue('items') || hasValue('discountType') || hasValue('discountValue')) {
      throw new BadRequestException('GROUPED_V2 packages cannot include legacy owner, items, or discount fields');
    }
    if (!dto.groups || !dto.globalDiscount) {
      throw new BadRequestException('GROUPED_V2 packages require groups and globalDiscount');
    }

    const offerings = await resolvePackageGroupOfferings(
      this.prisma,
      dto.groups as PackageGroupInputLike[],
      this.priceResolver,
    );
    const prices = offerings.flatMap((group) => group.sessions.map((session) => session.unitPrice));
    validateGroupedPackageStorageBounds(prices, dto.globalDiscount);
    allocateSessionNet(prices, dto.globalDiscount as unknown as GlobalDiscount);
    const groupRows = offerings.map((group, index) => ({
      id: randomUUID(),
      key: group.key,
      label: group.label ?? null,
      serviceId: group.serviceId,
      employeeId: group.employeeId,
      sequenceMode: group.sequenceMode,
      sortOrder: index,
    }));
    const groupIds = new Map(groupRows.map((row) => [row.key, row.id]));
    const packageData = {
      modelVersion: 'GROUPED_V2',
      ownerEmployeeId: null,
      nameAr: dto.nameAr,
      nameEn: dto.nameEn ?? null,
      descriptionAr: dto.descriptionAr ?? null,
      descriptionEn: dto.descriptionEn ?? null,
      imageUrl: dto.imageUrl ?? null,
      iconName: dto.iconName ?? null,
      iconBgColor: dto.iconBgColor ?? null,
      discountType: dto.globalDiscount.type === 'FIXED' ? DiscountType.FIXED : DiscountType.PERCENTAGE,
      discountValue: dto.globalDiscount.type === 'NONE' ? 0 : dto.globalDiscount.value,
      isActive: dto.isActive ?? true,
      isPublic: dto.isPublic ?? false,
      sortOrder: dto.sortOrder ?? 0,
    };

    const created = await this.rlsTransaction.withTransaction(async (tx) => {
      const txAny = tx as unknown as GroupedWriteTransaction;
      const pkg = await txAny.sessionPackage.create({ data: packageData });
      await txAny.sessionPackageGroup.createMany({
        data: groupRows.map((row, index) => ({
          ...row,
          packageId: pkg.id,
          dependsOnGroupId: offerings[index].dependsOnGroupKey
            ? groupIds.get(offerings[index].dependsOnGroupKey!) ?? null
            : null,
        })),
      });
      for (const [groupIndex, group] of offerings.entries()) {
        const groupId = groupRows[groupIndex].id;
        for (const [sessionIndex, session] of group.sessions.entries()) {
          await txAny.sessionPackageItem.create({
            data: {
              id: randomUUID(),
              packageId: pkg.id,
              groupId,
              sessionPosition: session.position,
              serviceId: group.serviceId,
              employeeId: group.employeeId,
              durationOptionId: session.durationOptionId,
              unitPrice: session.unitPrice,
              label: null,
              paidQuantity: 1,
              freeQuantity: 0,
              discountType: null,
              discountValue: 0,
              sortOrder: sessionIndex,
              constraints: {
                create: [
                  { dimension: 'SERVICE', mode: 'INCLUDE', targets: { create: [{ targetId: group.serviceId }] } },
                  { dimension: 'PRACTITIONER', mode: 'INCLUDE', targets: { create: [{ targetId: group.employeeId }] } },
                  { dimension: 'DURATION', mode: 'INCLUDE', targets: { create: [{ targetId: session.durationOptionId }] } },
                  { dimension: 'DELIVERY_TYPE', mode: 'INCLUDE', targets: { create: [{ targetId: session.deliveryType }] } },
                ],
              },
            },
          });
        }
      }
      return txAny.sessionPackage.findUnique({
        where: { id: pkg.id },
        include: {
          groups: { orderBy: { sortOrder: 'asc' }, include: { items: { include: { constraints: { include: { targets: true } } } } } },
          items: { orderBy: { sortOrder: 'asc' }, include: { constraints: { include: { targets: true } } } },
        },
      });
    });

    await this.cache.invalidatePrefix(PUBLIC_PACKAGES_CACHE_KEY);
    return created;
  }

  /**
   * Per-item discount validation against the computed lines (same order as items):
   *   PERCENTAGE → reject values outside [0,100].
   *   FIXED      → reject halalas amounts that exceed the item's payable (paid × unit).
   */
  private validateItemDiscounts(
    items: NonNullable<CreateSessionPackageDto['items']>,
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
