import { Injectable, Optional } from '@nestjs/common';
import { PrismaService, TransactionService } from '../../../../infrastructure/database';
import { CacheService } from '../../../../infrastructure/cache';
import { PriceResolverService } from '../../services/price-resolver.service';
import { PUBLIC_PACKAGES_CACHE_KEY } from '../../session-packages/list-public-packages/public-packages.cache';
import { CreatePackageFamilyDto } from '../package-family.dto';
import { writeGroupedFamilyOption } from '../package-family-write.helper';

@Injectable()
export class CreatePackageFamilyHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: TransactionService,
    @Optional() private readonly priceResolver?: PriceResolverService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  async execute(dto: CreatePackageFamilyDto) {
    return this.rlsTransaction.withTransaction(async (tx) => {
      const family = await tx.packageFamily.create({
        data: {
          nameAr: dto.nameAr,
          nameEn: dto.nameEn ?? null,
          descriptionAr: dto.descriptionAr ?? null,
          descriptionEn: dto.descriptionEn ?? null,
          imageUrl: dto.imageUrl ?? null,
          isActive: dto.isActive ?? true,
          isPublic: dto.isPublic ?? false,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      const options = [];
      for (const option of dto.options) {
        options.push(await writeGroupedFamilyOption(tx, option, family.id, tx, this.priceResolver));
      }
      return { ...family, options };
    }).then(async (result) => {
      if (this.cache && typeof this.cache.invalidatePrefix === 'function') await this.cache.invalidatePrefix(PUBLIC_PACKAGES_CACHE_KEY);
      return result;
    });
  }
}
