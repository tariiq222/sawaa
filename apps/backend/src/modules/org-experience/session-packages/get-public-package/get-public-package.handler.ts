import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { ComputePackagePriceService } from '../../compute-package-price.service';

export type GetPublicPackageCommand = { packageId: string };

/**
 * Public, unauthenticated detail of ONE sellable session package.
 *
 * 404s for any package that is not simultaneously public + active + non-archived
 * — a private/admin/deactivated/archived package must never be reachable from the
 * public surface, even by direct id. This mirrors the catalog-list filter so the
 * detail endpoint cannot be used to enumerate hidden packages.
 *
 * Decorated with the canonical computed price (same service as the catalog list
 * and the reception sale) so the price the client sees is what gets frozen.
 */
@Injectable()
export class GetPublicPackageHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: ComputePackagePriceService,
  ) {}

  async execute(dto: GetPublicPackageCommand) {
    const pkg = await this.prisma.sessionPackage.findFirst({
      where: {
        id: dto.packageId,
        isPublic: true,
        isActive: true,
        archivedAt: null,
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { constraints: { include: { targets: true } } },
        },
      },
    });
    if (!pkg) {
      // Same 404 for "does not exist" and "exists but not public" — do not leak
      // the existence of private packages.
      throw new NotFoundException('Session package not found');
    }

    const price = await this.pricing.compute({
      items: pkg.items.map((i) => ({
        serviceId: i.serviceId,
        employeeId: i.employeeId,
        durationOptionId: i.durationOptionId,
        unitPrice: i.unitPrice != null ? Number(i.unitPrice) : null,
        paidQuantity: i.paidQuantity,
        freeQuantity: i.freeQuantity,
        discountType: i.discountType,
        discountValue: Number(i.discountValue),
      })),
    }, { strict: false });

    return { ...pkg, price };
  }
}
