import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { toListResponse } from '../../../common/dto';
import { ListBranchesDto } from './list-branches.dto';
import { BRANCHES_CACHE_PREFIX } from './branches.cache';

export type ListBranchesQuery = ListBranchesDto;

@Injectable()
export class ListBranchesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: ListBranchesQuery) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    // Deterministic key over all normalized filters so distinct filter sets
    // never collide on the same cached payload.
    const keyParams = JSON.stringify({
      page,
      limit,
      isActive: dto.isActive ?? null,
      search: dto.search ?? null,
    });

    return this.cache.getOrSet(`${BRANCHES_CACHE_PREFIX}${keyParams}`, async () => {
      const where: Prisma.BranchWhereInput = {
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      };

      if (dto.search) {
        const search = dto.search.trim();
        if (search) {
          where.OR = [
            { nameAr: { contains: search, mode: 'insensitive' } },
            { nameEn: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ];
        }
      }

      const [items, total] = await this.rlsTransaction.withTransaction((tx) =>
        Promise.all([
          tx.branch.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
          }),
          tx.branch.count({ where }),
        ]),
      );

      return toListResponse(items, total, page, limit);
    });
  }
}
