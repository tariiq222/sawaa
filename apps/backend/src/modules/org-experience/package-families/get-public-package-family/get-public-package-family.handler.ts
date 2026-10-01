import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database';
import { MinioService } from '../../../../infrastructure/storage/minio.service';
import { ComputePackagePriceService } from '../../compute-package-price.service';
import { decorateFamily, loadFamilyDisplayData } from '../package-family-catalog.helper';
import { resolveVatRate } from '../../../finance/create-invoice/create-invoice.handler';

@Injectable()
export class GetPublicPackageFamilyHandler {
  private readonly bucket: string;
  constructor(private readonly prisma: PrismaService, private readonly pricing: ComputePackagePriceService, private readonly storage: MinioService, @Optional() config?: ConfigService) {
    this.bucket = config && typeof (config as any).getOrThrow === 'function' ? config.getOrThrow<string>('MINIO_BUCKET') : '';
  }
  async execute({ familyId }: { familyId: string }) {
    // Prices are net; clients add VAT for display with the same rounding as invoices.
    const vatRate = (await resolveVatRate(this.prisma)).toNumber();
    return { ...(await this.load(familyId)), vatRate };
  }

  private async load(familyId: string) {
    const family = await this.prisma.packageFamily.findFirst({ where: { id: familyId, isActive: true, isPublic: true, archivedAt: null, options: { some: { isActive: true, isPublic: true, archivedAt: null } } }, include: { options: { where: { isActive: true, isPublic: true, archivedAt: null }, orderBy: { sortOrder: 'asc' }, include: { groups: { orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { sessionPosition: 'asc' }, include: { constraints: { include: { targets: true } } } } } }, items: { orderBy: { sortOrder: 'asc' }, include: { constraints: { include: { targets: true } } } } } } } });
    if (family) {
      const display = await loadFamilyDisplayData(this.prisma, [family]);
      return decorateFamily(family, this.pricing, this.storage, this.bucket, false, display);
    }

    // The public list projects standalone packages into the same family-shaped
    // response. Resolve those projected IDs here as well so a detail link from
    // that list does not incorrectly 404.
    const standalone = await this.prisma.sessionPackage.findFirst({
      where: { id: familyId, familyId: null, isActive: true, isPublic: true, archivedAt: null },
      include: {
        groups: { orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { sessionPosition: 'asc' }, include: { constraints: { include: { targets: true } } } } } },
        items: { orderBy: { sortOrder: 'asc' }, include: { constraints: { include: { targets: true } } } },
      },
    });
    if (!standalone) throw new NotFoundException('Package family not found');
    const display = await loadFamilyDisplayData(this.prisma, [standalone]);
    return decorateFamily({
      id: standalone.id,
      nameAr: standalone.nameAr,
      nameEn: standalone.nameEn,
      descriptionAr: standalone.descriptionAr,
      descriptionEn: standalone.descriptionEn,
      imageUrl: standalone.imageUrl,
      isActive: standalone.isActive,
      isPublic: standalone.isPublic,
      sortOrder: standalone.sortOrder,
      archivedAt: standalone.archivedAt,
      createdAt: standalone.createdAt,
      updatedAt: standalone.updatedAt,
      options: [standalone],
    }, this.pricing, this.storage, this.bucket, true, display);
  }
}
