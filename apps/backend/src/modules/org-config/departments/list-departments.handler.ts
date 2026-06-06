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

      const [items, total] = await this.rlsTransaction.withTransaction((tx) =>
        Promise.all([
          tx.department.findMany({
            where,
            skip,
            take: limit,
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            include: { categories: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
          }),
          tx.department.count({ where }),
        ]),
      );

      return toListResponse(items, total, page, limit);
    });
  }
}
