import { Injectable } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { toListResponse } from '../../../common/dto';
import { ListDepartmentsDto } from './list-departments.dto';
import { DEPARTMENTS_CACHE_PREFIX } from './departments.cache';

export type ListDepartmentsQuery = ListDepartmentsDto;

@Injectable()
export class ListDepartmentsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: ListDepartmentsQuery) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    // Deterministic compact-JSON key from all query params so distinct filter
    // combinations get distinct cache entries.
    const keyParams = JSON.stringify({
      page,
      limit,
      isActive: dto.isActive,
      search: dto.search,
    });

    return this.cache.getOrSet(`${DEPARTMENTS_CACHE_PREFIX}${keyParams}`, async () => {
      const where = {
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.search && {
          OR: [
            { nameAr: { contains: dto.search, mode: 'insensitive' as const } },
            { nameEn: { contains: dto.search, mode: 'insensitive' as const } },
          ],
        }),
      };

      const [rawItems, total] = await this.rlsTransaction.withTransaction((tx) =>
        Promise.all([
          tx.department.findMany({
            where,
            skip,
            take: limit,
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            include: {
              categories: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
                include: {
                  // Count bookable services per active category so we can tell
                  // which categories are non-empty without a second round-trip.
                  _count: {
                    select: {
                      services: { where: { archivedAt: null, isActive: true, isHidden: false } },
                    },
                  },
                },
              },
            },
          }),
          tx.department.count({ where }),
        ]),
      );

      // bookableCategoriesCount = active categories that have ≥1 bookable
      // service. The wizard disables a department when this is 0.
      const items = rawItems.map((dept) => {
        const bookableCategoriesCount = dept.categories.filter(
          (c) => c._count.services > 0,
        ).length;
        const categories = dept.categories.map(({ _count, ...rest }) => rest);
        return { ...dept, categories, bookableCategoriesCount };
      });

      return toListResponse(items, total, page, limit);
    });
  }
}
