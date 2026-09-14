import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database';
import { MinioService } from '../../../../infrastructure/storage/minio.service';
import { ComputePackagePriceService } from '../../compute-package-price.service';
import { decorateFamily, loadFamilyDisplayData } from '../package-family-catalog.helper';

@Injectable()
export class GetPackageFamilyHandler {
  private readonly bucket: string;
  constructor(private readonly prisma: PrismaService, private readonly pricing: ComputePackagePriceService, private readonly storage: MinioService, @Optional() config?: ConfigService) {
    this.bucket = config && typeof (config as any).getOrThrow === 'function' ? config.getOrThrow<string>('MINIO_BUCKET') : '';
  }
  async execute({ familyId }: { familyId: string }) {
    const family = await this.prisma.packageFamily.findFirst({ where: { id: familyId, archivedAt: null }, include: { options: { where: { archivedAt: null }, orderBy: { sortOrder: 'asc' }, include: { groups: { orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { sessionPosition: 'asc' }, include: { constraints: { include: { targets: true } } } } } }, items: { orderBy: { sortOrder: 'asc' }, include: { constraints: { include: { targets: true } } } } } } } });
    if (!family) throw new NotFoundException('Package family not found');
    const display = await loadFamilyDisplayData(this.prisma, [family]);
    return decorateFamily(family, this.pricing, this.storage, this.bucket, false, display);
  }
}
