import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { UpdateCategoryDto } from './update-category.dto';
import { CATEGORIES_CACHE_PREFIX } from './categories.cache';
import { DEPARTMENTS_CACHE_PREFIX } from '../departments/departments.cache';

export type UpdateCategoryCommand = UpdateCategoryDto & { categoryId: string };

@Injectable()
export class UpdateCategoryHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: UpdateCategoryCommand) {
    const existing = await this.prisma.serviceCategory.findFirst({
      where: { id: dto.categoryId },
    });
    if (!existing) throw new NotFoundException('ServiceCategory not found');

    const category = await this.prisma.serviceCategory.update({
      where: { id: dto.categoryId },
      data: {
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.cache.invalidatePrefix(CATEGORIES_CACHE_PREFIX);
    await this.cache.invalidatePrefix(DEPARTMENTS_CACHE_PREFIX); // departments list embeds active categories

    return category;
  }
}
