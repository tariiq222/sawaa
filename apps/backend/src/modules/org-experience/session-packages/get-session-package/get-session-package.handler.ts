import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { ComputePackagePriceService } from '../../compute-package-price.service';

export type GetSessionPackageCommand = { packageId: string };

/**
 * Fetch one package by id (excluding archived) and decorate it with the
 * canonical computed price for catalog UI: subtotal / discountAmount /
 * finalPrice + per-item resolved unit prices.
 */
@Injectable()
export class GetSessionPackageHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: ComputePackagePriceService,
  ) {}

  async execute(dto: GetSessionPackageCommand) {
    const pkg = await this.prisma.sessionPackage.findFirst({
      where: { id: dto.packageId, archivedAt: null },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { constraints: { include: { targets: true } } },
        },
      },
    });
    if (!pkg) {
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
        // Per-item discount. PERCENTAGE stored as 0-100; FIXED as integer halalas.
        discountType: i.discountType,
        discountValue: Number(i.discountValue),
      })),
    }, { strict: false });

    return { ...pkg, price };
  }
}