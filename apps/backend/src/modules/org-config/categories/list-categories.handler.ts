import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { toListResponse } from '../../../common/dto';
import { ListCategoriesDto } from './list-categories.dto';
import { CATEGORIES_CACHE_PREFIX } from './categories.cache';

export type ListCategoriesQuery = ListCategoriesDto;

@Injectable()
export class ListCategoriesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: ListCategoriesQuery) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    // Deterministic key over all normalized filters so distinct filter sets
    // never collide on the same cached payload.
    const keyParams = JSON.stringify({
      page,
      limit,
      departmentId: dto.departmentId ?? null,
      isActive: dto.isActive ?? null,
      search: dto.search ?? null,
    });

    return this.cache.getOrSet(`${CATEGORIES_CACHE_PREFIX}${keyParams}`, async () => {
      const where: Prisma.ServiceCategoryWhereInput = {
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.search && {
          OR: [
            { nameAr: { contains: dto.search, mode: 'insensitive' } },
            { nameEn: { contains: dto.search, mode: 'insensitive' } },
          ],
        }),
      };

      const [items, total] = await this.rlsTransaction.withTransaction((tx) =>
        Promise.all([
          tx.serviceCategory.findMany({
            where,
            skip,
            take: limit,
            include: {
              _count: {
                select: {
                  // Bookable services only: a category whose services are all
                  // archived/inactive/hidden is effectively empty in the booking
                  // flow, so the wizard disables it.
                  services: { where: { archivedAt: null, isActive: true, isHidden: false } },
                },
              },
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
          }),
          tx.serviceCategory.count({ where }),
        ]),
      );

      return toListResponse(items, total, page, limit);
    });
  }
}
