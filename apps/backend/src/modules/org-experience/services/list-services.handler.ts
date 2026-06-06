import { Injectable } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { toListResponse } from '../../../common/dto';
import { ListServicesDto } from './list-services.dto';
import { SERVICES_CACHE_PREFIX } from './services.cache';

export type ListServicesCommand = ListServicesDto;

@Injectable()
export class ListServicesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: ListServicesCommand) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    // Deterministic key over all normalized filters so distinct filter sets
    // never collide on the same cached payload.
    const keyParams = JSON.stringify({
      page,
      limit,
      isActive: dto.isActive ?? null,
      includeHidden: dto.includeHidden ?? false,
      categoryId: dto.categoryId ?? null,
      search: dto.search ?? null,
    });

    return this.cache.getOrSet(`${SERVICES_CACHE_PREFIX}${keyParams}`, async () => {
      const where = {
        archivedAt: null,
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        // إخفاء الخدمات المخفية افتراضياً ما لم يُطلب تضمينها صراحةً
        ...(dto.includeHidden !== true && { isHidden: false }),
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.search && {
          OR: [
            { nameAr: { contains: dto.search, mode: 'insensitive' as const } },
            { nameEn: { contains: dto.search, mode: 'insensitive' as const } },
          ],
        }),
      };

      const [items, total] = await this.rlsTransaction.withTransaction((tx) =>
        Promise.all([
          tx.service.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
              category: true,
              durationOptions: { orderBy: { sortOrder: 'asc' } },
            },
          }),
          tx.service.count({ where }),
        ]),
      );

      return toListResponse(items, total, page, limit);
    });
  }
}
