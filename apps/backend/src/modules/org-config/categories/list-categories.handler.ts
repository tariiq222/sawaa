import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { signMediaImageUrl } from '../../media/media-image-url.helper';
import { toListResponse, type ListResponse } from '../../../common/dto';
import { ListCategoriesDto } from './list-categories.dto';
import { CATEGORIES_CACHE_PREFIX } from './categories.cache';

export type ListCategoriesQuery = ListCategoriesDto;

@Injectable()
export class ListCategoriesHandler {
  private readonly mediaBucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly cache: CacheService,
    private readonly storage: MinioService,
    config: ConfigService,
  ) {
    this.mediaBucket = config.getOrThrow<string>('MINIO_BUCKET');
  }

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

    const response = await this.cache.getOrSet(`${CATEGORIES_CACHE_PREFIX}${keyParams}`, async () => {
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

      const [rawItems, total] = await this.rlsTransaction.withTransaction((tx) =>
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
              department: {
                select: { id: true, nameAr: true, nameEn: true },
              },
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
          }),
          tx.serviceCategory.count({ where }),
        ]),
      );

      // DIRECT categories have one hidden internal service. Override the bookable-
      // service count so the wizard never disables them for having zero visible services.
      const items = rawItems.map((cat) => ({
        ...cat,
        _count: {
          ...cat._count,
          services: cat.bookingMode === 'DIRECT' ? Math.max(cat._count.services, 1) : cat._count.services,
        },
      }));

      return toListResponse(items, total, page, limit);
    });

    // Sign category images at read time. The cached payload holds bare object
    // keys; mint fresh short-lived presigned URLs per response (signed
    // concurrently) so the admin preview never serves an expired signature.
    type CategoryItem = (typeof response.items)[number];
    const items: CategoryItem[] = await Promise.all(
      response.items.map(async (cat) => ({
        ...cat,
        imageUrl: await signMediaImageUrl(this.storage, this.mediaBucket, cat.imageUrl),
      })),
    );

    const result: ListResponse<CategoryItem> = { ...response, items };
    return result;
  }
}
