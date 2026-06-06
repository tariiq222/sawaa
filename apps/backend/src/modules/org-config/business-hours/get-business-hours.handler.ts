import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { BUSINESS_HOURS_CACHE_PREFIX } from './business-hours.cache';

export type GetBusinessHoursQuery = { branchId: string };

@Injectable()
export class GetBusinessHoursHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: GetBusinessHoursQuery) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    // Cache only the hours payload; branch existence is validated above on every
    // call so a deleted branch still 404s even with a warm cache.
    return this.cache.getOrSet(`${BUSINESS_HOURS_CACHE_PREFIX}${dto.branchId}`, () =>
      this.prisma.businessHour.findMany({
        where: { branchId: dto.branchId },
        orderBy: { dayOfWeek: 'asc' },
      }),
    );
  }
}
