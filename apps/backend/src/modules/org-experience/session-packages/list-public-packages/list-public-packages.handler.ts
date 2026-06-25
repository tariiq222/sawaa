import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { ComputePackagePriceService } from '../../compute-package-price.service';

/**
 * Public, unauthenticated catalog of sellable session packages.
 *
 * Surfaces ONLY packages that are simultaneously:
 *   - isPublic   = true   (admin-only/private packages stay hidden)
 *   - isActive   = true   (deactivated packages are not sellable)
 *   - archivedAt = null   (archived packages are gone)
 *
 * Each entry is decorated with the canonical computed price
 * (subtotal / discountAmount / finalPrice + per-item unit prices) via the SAME
 * ComputePackagePriceService the dashboard + reception sale use, so the catalog
 * price the client sees is identical to what gets frozen at purchase time.
 *
 * Ordered by (sortOrder asc, createdAt desc) to match the dashboard list order.
 */
@Injectable()
export class ListPublicPackagesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: ComputePackagePriceService,
  ) {}

  async execute() {
    const packages = await this.prisma.sessionPackage.findMany({
      where: { isPublic: true, isActive: true, archivedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    return Promise.all(
      packages.map(async (pkg) => {
        const price = await this.pricing.compute({
          items: pkg.items.map((i) => ({
            serviceId: i.serviceId,
            employeeId: i.employeeId,
            durationOptionId: i.durationOptionId,
            paidQuantity: i.paidQuantity,
            freeQuantity: i.freeQuantity,
          })),
          discountType: pkg.discountType,
          discountValue: Number(pkg.discountValue),
        });
        return { ...pkg, price };
      }),
    );
  }
}
