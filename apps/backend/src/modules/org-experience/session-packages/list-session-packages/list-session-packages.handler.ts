import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { toListResponse } from '../../../../common/dto';
import { ComputePackagePriceService } from '../../compute-package-price.service';
import { ListSessionPackagesDto } from './list-session-packages.dto';

export type ListSessionPackagesCommand = ListSessionPackagesDto;

/**
 * Paginated list of session packages with optional filters:
 *   - archivedAt:null is always enforced
 *   - isActive filter (optional)
 *   - isPublic filter (optional)
 *   - case-insensitive contains-search over nameAr / nameEn
 *
 * Each row is decorated with the canonical computed price
 * (subtotal / discountAmount / finalPrice / fullValue / freeValue) via the SAME
 * ComputePackagePriceService the get/public endpoints use, so the dashboard
 * list table and the reception sell-package dialog show the real frozen price
 * instead of zeros. Money fields are flattened onto the row to match the
 * dashboard `SessionPackage` type.
 *
 * Returns the canonical `{ items, meta }` shape via toListResponse.
 */
@Injectable()
export class ListSessionPackagesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: ComputePackagePriceService,
  ) {}

  async execute(dto: ListSessionPackagesCommand) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      archivedAt: null,
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      ...(dto.search && {
        OR: [
          { nameAr: { contains: dto.search, mode: 'insensitive' as const } },
          { nameEn: { contains: dto.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.sessionPackage.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      }),
      this.prisma.sessionPackage.count({ where }),
    ]);

    // Batched pricing (P1-4): one set of three bulk lookups for the whole page
    // instead of 3 × Σ items per-package round-trips.
    const prices = await this.pricing.computeMany(
      items.map((pkg) =>
        pkg.items.map((i) => ({
          serviceId: i.serviceId,
          employeeId: i.employeeId,
          durationOptionId: i.durationOptionId,
          paidQuantity: i.paidQuantity,
          freeQuantity: i.freeQuantity,
          discountType: i.discountType,
          discountValue: Number(i.discountValue),
        })),
      ),
    );
    const priced = items.map((pkg, idx) => ({
      ...pkg,
      subtotal: prices[idx].subtotal,
      discountAmount: prices[idx].discountAmount,
      finalPrice: prices[idx].finalPrice,
      fullValue: prices[idx].fullValue,
      freeValue: prices[idx].freeValue,
    }));

    return toListResponse(priced, total, page, limit);
  }
}