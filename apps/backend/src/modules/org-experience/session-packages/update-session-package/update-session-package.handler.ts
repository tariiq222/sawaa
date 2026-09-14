import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { toHalalas } from '../../../finance/money.helper';
import { UpdateSessionPackageDto } from './update-session-package.dto';
import { CreateSessionPackageItemDto } from '../create-session-package/create-session-package.dto';
import { ComputePackagePriceService } from '../../compute-package-price.service';
import {
  buildItemCreateData,
  buildPriceInput,
} from '../package-constraints.helper';
import type { NormalizedItem } from '../package-constraints.helper';
import { validatePackageItemsForOwner } from '../package-owner.helper';
import { CacheService } from '../../../../infrastructure/cache';
import { PUBLIC_PACKAGES_CACHE_KEY } from '../list-public-packages/public-packages.cache';
import { allocateSessionNet } from '../package-group-pricing';
import { resolvePackageGroupOfferings, validateGroupedPackageStorageBounds } from '../package-group-offering.helper';
import type { PackageGroupInputLike } from '../package-group-offering.helper';
import { PriceResolverService } from '../../services/price-resolver.service';
import { randomUUID } from 'node:crypto';
import { decorateGroupedPackage } from '../package-group-catalog.helper';
import type { GroupedCatalogPackage } from '../package-group-catalog.helper';
import type { GlobalDiscount } from '@sawaa/shared/types';

type GroupedUpdateTransaction = {
  sessionPackageItem: {
    deleteMany(args: { where: Record<string, unknown> }): Promise<unknown>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  sessionPackageGroup: {
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
    deleteMany(args: { where: Record<string, unknown> }): Promise<unknown>;
    createMany(args: { data: Record<string, unknown>[] }): Promise<unknown>;
  };
  sessionPackage: {
    update(args: { where: Record<string, unknown>; data: Record<string, unknown>; include: Record<string, unknown> }): Promise<unknown>;
  };
};

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
    @Optional() private readonly priceResolver?: PriceResolverService,
  ) {}

  async execute(dto: UpdateSessionPackageCommand) {
    const loadedExisting = await this.prisma.sessionPackage.findFirst({
      where: { id: dto.packageId, archivedAt: null },
      include: { items: true },
    });
    if (!loadedExisting) {
      throw new NotFoundException('Session package not found');
    }
    let existing = loadedExisting;

    if (existing.modelVersion === 'GROUPED_V2' && !Object.prototype.hasOwnProperty.call(existing, 'groups')) {
      const groupedExisting = await this.prisma.sessionPackage.findFirst({
        where: { id: dto.packageId, archivedAt: null },
        include: {
          items: true,
          groups: {
            orderBy: { sortOrder: 'asc' },
            include: { items: { include: { constraints: { include: { targets: true } } } } },
          },
        },
      });
      if (!groupedExisting) {
        throw new NotFoundException('Session package not found');
      }
      existing = groupedExisting;
    }
    if (existing.modelVersion === 'GROUPED_V2') {
      return this.updateGrouped(dto, existing as unknown as GroupedCatalogPackage);
    }
    if (dto.modelVersion === 'GROUPED_V2' || dto.groups !== undefined || dto.globalDiscount !== undefined) {
      throw new BadRequestException('LEGACY packages cannot be converted to GROUPED_V2 in place');
    }

    const itemsProvided = dto.items !== undefined;
    const ownerChanged = dto.ownerEmployeeId !== undefined && dto.ownerEmployeeId !== existing.ownerEmployeeId;
    if (ownerChanged && !itemsProvided) {
      throw new BadRequestException('Changing the package owner requires replacing items in the same update');
    }
    const effectiveOwner = dto.ownerEmployeeId !== undefined
      ? dto.ownerEmployeeId
      : existing.ownerEmployeeId;

    // 1. Validate items + their per-item discounts when a new set is provided.
    let normalized: NormalizedItem[] = [];
    if (itemsProvided) {
      normalized = await validatePackageItemsForOwner(this.prisma, dto.items!, effectiveOwner);
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
          ...(dto.ownerEmployeeId !== undefined && { ownerEmployeeId: dto.ownerEmployeeId }),
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

  private async updateGrouped(dto: UpdateSessionPackageCommand, existing: GroupedCatalogPackage) {
    const hasValue = (key: keyof UpdateSessionPackageCommand) => dto[key] !== undefined;
    if (dto.modelVersion !== undefined && dto.modelVersion !== 'GROUPED_V2') {
      throw new BadRequestException('Session package modelVersion cannot change in place');
    }
    if (hasValue('items') || hasValue('discountType') || hasValue('discountValue')) {
      throw new BadRequestException('GROUPED_V2 packages cannot include legacy items or discount fields');
    }
    if (hasValue('ownerEmployeeId') && dto.ownerEmployeeId != null) {
      throw new BadRequestException('GROUPED_V2 packages cannot have an ownerEmployeeId');
    }
    if (dto.groups !== undefined && (!Array.isArray(dto.groups) || dto.groups.length === 0)) {
      throw new BadRequestException('GROUPED_V2 packages require at least one group');
    }
    if (dto.globalDiscount === null) {
      throw new BadRequestException('globalDiscount must be an object when supplied');
    }

    const offerings = dto.groups
      ? await resolvePackageGroupOfferings(this.prisma, dto.groups as PackageGroupInputLike[], this.priceResolver)
      : undefined;
    const effectiveGroups = offerings ?? decorateGroupedPackage(existing).groups;
    const effectiveDiscount = dto.globalDiscount ?? this.storedGlobalDiscount(existing);
    const prices = effectiveGroups.flatMap((group) => group.sessions.map((session) => session.unitPrice));
    validateGroupedPackageStorageBounds(prices, effectiveDiscount);
    allocateSessionNet(prices, effectiveDiscount);
    const packageData: Record<string, unknown> = {
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
      ...(dto.globalDiscount && {
        discountType: dto.globalDiscount.type === 'FIXED' ? DiscountType.FIXED : DiscountType.PERCENTAGE,
        discountValue: dto.globalDiscount.type === 'NONE' ? 0 : dto.globalDiscount.value,
      }),
    };

    const updated = await this.rlsTransaction.withTransaction(async (tx) => {
      const txAny = tx as unknown as GroupedUpdateTransaction;
      if (offerings) {
        await txAny.sessionPackageItem.deleteMany({ where: { packageId: dto.packageId } });
        await txAny.sessionPackageGroup.updateMany({ where: { packageId: dto.packageId }, data: { dependsOnGroupId: null } });
        await txAny.sessionPackageGroup.deleteMany({ where: { packageId: dto.packageId } });
        const groupRows = effectiveGroups.map((group, index) => ({
          id: randomUUID(), packageId: dto.packageId, key: group.key, label: group.label ?? null,
          serviceId: group.serviceId, employeeId: group.employeeId, sequenceMode: group.sequenceMode, sortOrder: index,
        }));
        const groupIds = new Map(groupRows.map((row) => [row.key, row.id]));
        await txAny.sessionPackageGroup.createMany({
          data: groupRows.map((row, index) => ({
            ...row,
            dependsOnGroupId: effectiveGroups[index].dependsOnGroupKey
              ? groupIds.get(effectiveGroups[index].dependsOnGroupKey!) ?? null
              : null,
          })),
        });
        for (const [groupIndex, group] of effectiveGroups.entries()) {
          for (const [sessionIndex, session] of group.sessions.entries()) {
            await txAny.sessionPackageItem.create({
              data: {
                id: randomUUID(), packageId: dto.packageId, groupId: groupRows[groupIndex].id,
                sessionPosition: session.position, serviceId: group.serviceId, employeeId: group.employeeId,
                durationOptionId: session.durationOptionId, unitPrice: session.unitPrice, label: null,
                paidQuantity: 1, freeQuantity: 0, discountType: null, discountValue: 0, sortOrder: sessionIndex,
                constraints: { create: [
                  { dimension: 'SERVICE', mode: 'INCLUDE', targets: { create: [{ targetId: group.serviceId }] } },
                  { dimension: 'PRACTITIONER', mode: 'INCLUDE', targets: { create: [{ targetId: group.employeeId }] } },
                  { dimension: 'DURATION', mode: 'INCLUDE', targets: { create: [{ targetId: session.durationOptionId }] } },
                  { dimension: 'DELIVERY_TYPE', mode: 'INCLUDE', targets: { create: [{ targetId: session.deliveryType }] } },
                ] },
              },
            });
          }
        }
      }
      return txAny.sessionPackage.update({
        where: { id: dto.packageId },
        data: packageData,
        include: {
          groups: { orderBy: { sortOrder: 'asc' }, include: { items: { include: { constraints: { include: { targets: true } } } } } },
          items: { orderBy: { sortOrder: 'asc' }, include: { constraints: { include: { targets: true } } } },
        },
      });
    });
    await this.cache.invalidatePrefix(PUBLIC_PACKAGES_CACHE_KEY);
    return updated;
  }

  private storedGlobalDiscount(existing: GroupedCatalogPackage): GlobalDiscount {
    const value = Number(existing.discountValue?.toString?.() ?? existing.discountValue ?? 0);
    if (existing.discountType === DiscountType.FIXED) return { type: 'FIXED', value };
    if (value > 0) return { type: 'PERCENTAGE', value };
    return { type: 'NONE', value: 0 };
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
