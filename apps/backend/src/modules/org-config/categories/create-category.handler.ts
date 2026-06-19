import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { CreateCategoryDto } from './create-category.dto';
import { CATEGORIES_CACHE_PREFIX } from './categories.cache';
import { DEPARTMENTS_CACHE_PREFIX } from '../departments/departments.cache';

export type CreateCategoryCommand = CreateCategoryDto;

@Injectable()
export class CreateCategoryHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: CreateCategoryCommand) {
    const category = await this.rlsTransaction.withTransaction(async (tx) => {
      const cat = await tx.serviceCategory.create({
        data: {
          nameAr: dto.nameAr,
          nameEn: dto.nameEn,
          departmentId: dto.departmentId ?? null,
          sortOrder: dto.sortOrder ?? 0,
          bookingMode: dto.bookingMode ?? 'SERVICES',
          imageUrl: dto.imageUrl ?? null,
          iconName: dto.iconName ?? null,
          iconBgColor: dto.iconBgColor ?? null,
        },
      });

      if (cat.bookingMode === 'DIRECT') {
        await tx.service.create({
          data: {
            categoryId: cat.id,
            nameAr: dto.nameAr,
            nameEn: dto.nameEn ?? null,
            price: new Prisma.Decimal(0),
            durationMins: 30,
            isHidden: true,
            isActive: true,
          },
        });
      }

      return cat;
    });

    await this.cache.invalidatePrefix(CATEGORIES_CACHE_PREFIX);
    await this.cache.invalidatePrefix(DEPARTMENTS_CACHE_PREFIX); // departments list embeds active categories

    return category;
  }
}
