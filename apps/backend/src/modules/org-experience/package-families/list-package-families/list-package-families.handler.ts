import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database';
import { MinioService } from '../../../../infrastructure/storage/minio.service';
import { ComputePackagePriceService } from '../../compute-package-price.service';
import { decorateFamily, loadFamilyDisplayData } from '../package-family-catalog.helper';

@Injectable()
export class ListPackageFamiliesHandler {
  private readonly bucket: string;
  constructor(private readonly prisma: PrismaService, private readonly pricing: ComputePackagePriceService, private readonly storage: MinioService, @Optional() config?: ConfigService) {
    this.bucket = config && typeof (config as any).getOrThrow === 'function' ? config.getOrThrow<string>('MINIO_BUCKET') : '';
  }
  async execute() {
    const families = await this.prisma.packageFamily.findMany({
      where: { archivedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { options: { where: { archivedAt: null }, orderBy: { sortOrder: 'asc' }, include: { groups: { orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { sessionPosition: 'asc' }, include: { constraints: { include: { targets: true } } } } } }, items: { orderBy: { sortOrder: 'asc' }, include: { constraints: { include: { targets: true } } } } } } },
    });
    const display = await loadFamilyDisplayData(this.prisma, families);
    return Promise.all(families.map((family) => decorateFamily(family, this.pricing, this.storage, this.bucket, false, display)));
  }
}
