import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { toListResponse } from '../../../../common/dto';
import { ListSessionPackagesDto } from './list-session-packages.dto';

export type ListSessionPackagesCommand = ListSessionPackagesDto;

/**
 * Paginated list of session packages with optional filters:
 *   - archivedAt:null is always enforced
 *   - isActive filter (optional)
 *   - isPublic filter (optional)
 *   - case-insensitive contains-search over nameAr / nameEn
 *
 * Returns the canonical `{ items, meta }` shape via toListResponse.
 */
@Injectable()
export class ListSessionPackagesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListSessionPackagesCommand) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      archivedAt: null,
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      ...(dto.search && {
        OR: [
          { nameAr: { contains: dto.search, mode: 'insensitive' as const } },
          { nameEn: { contains: dto.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.sessionPackage.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      }),
      this.prisma.sessionPackage.count({ where }),
    ]);

    return toListResponse(items, total, page, limit);
  }
}