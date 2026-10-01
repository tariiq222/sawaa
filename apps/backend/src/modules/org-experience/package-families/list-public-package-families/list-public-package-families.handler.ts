import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database';
import { MinioService } from '../../../../infrastructure/storage/minio.service';
import { ComputePackagePriceService } from '../../compute-package-price.service';
import { decorateFamily, loadFamilyDisplayData } from '../package-family-catalog.helper';
import { resolveVatRate } from '../../../finance/create-invoice/create-invoice.handler';

@Injectable()
export class ListPublicPackageFamiliesHandler {
  private readonly bucket: string;
  constructor(private readonly prisma: PrismaService, private readonly pricing: ComputePackagePriceService, private readonly storage: MinioService, @Optional() config?: ConfigService) {
    this.bucket = config && typeof (config as any).getOrThrow === 'function' ? config.getOrThrow<string>('MINIO_BUCKET') : '';
  }
  async execute() {
    const [families, standalone] = await Promise.all([
      this.prisma.packageFamily.findMany({
        where: { isActive: true, isPublic: true, archivedAt: null, options: { some: { isActive: true, isPublic: true, archivedAt: null } } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { options: { where: { isActive: true, isPublic: true, archivedAt: null }, orderBy: { sortOrder: 'asc' }, include: { groups: { orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { sessionPosition: 'asc' }, include: { constraints: { include: { targets: true } } } } } }, items: { orderBy: { sortOrder: 'asc' }, include: { constraints: { include: { targets: true } } } } } } },
      }),
      this.prisma.sessionPackage.findMany({
        where: { familyId: null, isActive: true, isPublic: true, archivedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { groups: { orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { sessionPosition: 'asc' }, include: { constraints: { include: { targets: true } } } } } }, items: { orderBy: { sortOrder: 'asc' }, include: { constraints: { include: { targets: true } } } } },
      }),
    ]);
    const sellableFamilies = families
      .filter((family: any) => family.isActive === true && family.isPublic === true && family.archivedAt == null)
      .map((family: any) => ({
        ...family,
        options: (family.options ?? []).filter((option: any) => option.isActive === true && option.isPublic === true && option.archivedAt == null),
      }))
      .filter((family: any) => family.options.length > 0);
    const display = await loadFamilyDisplayData(this.prisma, [...sellableFamilies, ...standalone]);
    const mappedFamilies = await Promise.all(sellableFamilies.map((family) => decorateFamily(family, this.pricing, this.storage, this.bucket, false, display)));
    const mappedStandalone = await Promise.all(standalone.map(async (option: any) => decorateFamily({
      id: option.id,
      nameAr: option.nameAr,
      nameEn: option.nameEn,
      descriptionAr: option.descriptionAr,
      descriptionEn: option.descriptionEn,
      imageUrl: option.imageUrl,
      isActive: option.isActive,
      isPublic: option.isPublic,
      sortOrder: option.sortOrder,
      archivedAt: option.archivedAt,
      createdAt: option.createdAt,
      updatedAt: option.updatedAt,
      options: [option],
    }, this.pricing, this.storage, this.bucket, true, display)));
    // Prices are net; clients add VAT for display with the same rounding as invoices.
    const vatRate = (await resolveVatRate(this.prisma)).toNumber();
    return [...mappedFamilies, ...mappedStandalone].map((family) => ({ ...family, vatRate }));
  }
}
