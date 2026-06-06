import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { CATEGORIES_CACHE_PREFIX } from './categories.cache';
import { DEPARTMENTS_CACHE_PREFIX } from '../departments/departments.cache';

export interface DeleteCategoryCommand {
  categoryId: string;
}

@Injectable()
export class DeleteCategoryHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async execute({ categoryId }: DeleteCategoryCommand) {
    const existing = await this.prisma.serviceCategory.findFirst({
      where: { id: categoryId },
    });
    if (!existing) throw new NotFoundException('Category not found');

    const activeServiceCount = await this.prisma.service.count({
      where: { categoryId, archivedAt: null },
    });

    if (activeServiceCount > 0) {
      throw new BadRequestException(
        'Category still has services; reassign or delete them first',
      );
    }
    const category = await this.prisma.serviceCategory.delete({ where: { id: categoryId } });

    await this.cache.invalidatePrefix(CATEGORIES_CACHE_PREFIX);
    await this.cache.invalidatePrefix(DEPARTMENTS_CACHE_PREFIX); // departments list embeds active categories

    return category;
  }
}
