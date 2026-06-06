import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { CreateCategoryDto } from './create-category.dto';
import { CATEGORIES_CACHE_PREFIX } from './categories.cache';
import { DEPARTMENTS_CACHE_PREFIX } from '../departments/departments.cache';

export type CreateCategoryCommand = CreateCategoryDto;

@Injectable()
export class CreateCategoryHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: CreateCategoryCommand) {
    const category = await this.prisma.serviceCategory.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        departmentId: dto.departmentId ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.cache.invalidatePrefix(CATEGORIES_CACHE_PREFIX);
    await this.cache.invalidatePrefix(DEPARTMENTS_CACHE_PREFIX); // departments list embeds active categories

    return category;
  }
}
