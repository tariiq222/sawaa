import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { CacheService } from '../../../../infrastructure/cache';
import { PriceResolverService } from '../../services/price-resolver.service';
import { PUBLIC_PACKAGES_CACHE_KEY } from '../../session-packages/list-public-packages/public-packages.cache';
import { UpdatePackageFamilyDto } from '../package-family.dto';
import { writeGroupedFamilyOption } from '../package-family-write.helper';

@Injectable()
export class UpdatePackageFamilyHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    @Optional() private readonly priceResolver?: PriceResolverService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  async execute(dto: UpdatePackageFamilyDto & { familyId: string }) {
    const familyId = dto.familyId;
    return this.rlsTransaction.withTransaction(async (tx) => {
      // Serialize complete option-list replacements with other family edits
      // (including archive) so two concurrent writes cannot merge stale lists.
      await tx.$queryRaw`SELECT id FROM "PackageFamily" WHERE id = ${familyId} FOR UPDATE`;
      const family = await (tx as any).packageFamily.findUnique({ where: { id: familyId }, include: { options: { select: { id: true, familyId: true, archivedAt: true } } } });
      if (!family) throw new NotFoundException('Package family not found');
      const suppliedIds = new Set(dto.options.map((option) => option.id).filter((id): id is string => !!id));
      if (suppliedIds.size !== dto.options.filter((option) => option.id).length) {
        throw new BadRequestException('Package family options must not repeat an existing option');
      }
      for (const option of dto.options) {
        if (option.id) {
          const existing = family.options.find((candidate: any) => candidate.id === option.id);
          if (!existing) {
            const foreign = await (tx as any).sessionPackage.findUnique({ where: { id: option.id }, select: { familyId: true } });
            if (foreign?.familyId && foreign.familyId !== familyId) throw new BadRequestException('Package option belongs to another family');
            throw new NotFoundException('Package option not found in this family');
          }
          if (existing.familyId !== familyId) throw new BadRequestException('Package option belongs to another family');
          await writeGroupedFamilyOption(tx as any, option, familyId, tx, this.priceResolver, option.id);
        } else {
          await writeGroupedFamilyOption(tx as any, option, familyId, tx, this.priceResolver);
        }
      }
      for (const existing of family.options) {
        if (!suppliedIds.has(existing.id) && existing.archivedAt == null) {
          await (tx as any).sessionPackage.update({ where: { id: existing.id }, data: { archivedAt: new Date(), isActive: false, isPublic: false } });
        }
      }
      return (tx as any).packageFamily.update({
        where: { id: familyId },
        data: {
          ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
          ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
          ...(dto.descriptionAr !== undefined && { descriptionAr: dto.descriptionAr }),
          ...(dto.descriptionEn !== undefined && { descriptionEn: dto.descriptionEn }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        },
      });
    }).then(async (result) => {
      if (this.cache && typeof (this.cache as any).invalidatePrefix === 'function') await this.cache.invalidatePrefix(PUBLIC_PACKAGES_CACHE_KEY);
      return result;
    });
  }
}
