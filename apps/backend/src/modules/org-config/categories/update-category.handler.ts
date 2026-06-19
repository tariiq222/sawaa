import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { UpdateCategoryDto } from './update-category.dto';
import { CATEGORIES_CACHE_PREFIX } from './categories.cache';
import { DEPARTMENTS_CACHE_PREFIX } from '../departments/departments.cache';

export type UpdateCategoryCommand = UpdateCategoryDto & { categoryId: string };

@Injectable()
export class UpdateCategoryHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: UpdateCategoryCommand) {
    const existing = await this.prisma.serviceCategory.findFirst({
      where: { id: dto.categoryId },
    });
    if (!existing) throw new NotFoundException('ServiceCategory not found');

    const category = await this.rlsTransaction.withTransaction(async (tx) => {
      const cat = await tx.serviceCategory.update({
        where: { id: dto.categoryId },
        data: {
          ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
          ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
          ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.bookingMode !== undefined && { bookingMode: dto.bookingMode }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
          ...(dto.iconName !== undefined && { iconName: dto.iconName }),
          ...(dto.iconBgColor !== undefined && { iconBgColor: dto.iconBgColor }),
        },
      });

      if (cat.bookingMode === 'DIRECT') {
        const existingHidden = await tx.service.findFirst({
          where: { categoryId: dto.categoryId, isHidden: true },
          select: { id: true },
        });
        if (!existingHidden) {
          await tx.service.create({
            data: {
              categoryId: cat.id,
              nameAr: cat.nameAr,
              nameEn: cat.nameEn ?? null,
              price: new Prisma.Decimal(0),
              durationMins: 30,
              isHidden: true,
              isActive: true,
            },
          });
        }
      }

      return cat;
    });

    await this.cache.invalidatePrefix(CATEGORIES_CACHE_PREFIX);
    await this.cache.invalidatePrefix(DEPARTMENTS_CACHE_PREFIX); // departments list embeds active categories

    return category;
  }
}
