import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { signMediaImageUrl } from '../../media/media-image-url.helper';
import { UpdateCategoryDto } from './update-category.dto';
import { CATEGORIES_CACHE_PREFIX } from './categories.cache';
import { DEPARTMENTS_CACHE_PREFIX } from '../departments/departments.cache';
import { SERVICES_CACHE_PREFIX } from '../../org-experience/services/services.cache';

export type UpdateCategoryCommand = UpdateCategoryDto & { categoryId: string };

@Injectable()
export class UpdateCategoryHandler {
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

  async execute(dto: UpdateCategoryCommand) {
    const category = await this.rlsTransaction.withTransaction(async (tx) => {
      const existing = await tx.serviceCategory.findFirst({ where: { id: dto.categoryId } });
      if (!existing) throw new NotFoundException('ServiceCategory not found');
      // See docs/architecture/clinic-service-booking-contract.md: changing mode would
      // reinterpret service links and existing booking/payment snapshots.
      if (dto.bookingMode !== undefined && dto.bookingMode !== existing.bookingMode) {
        throw new ConflictException('CATEGORY_BOOKING_MODE_LOCKED');
      }
      if ((dto.kind ?? existing.kind ?? 'CLINIC') === 'SERVICE_GROUP' && existing.bookingMode === 'DIRECT') {
        throw new BadRequestException('SERVICE_GROUP requires SERVICES booking mode');
      }
      const cat = await tx.serviceCategory.update({
        where: { id: dto.categoryId },
        data: {
          ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
          ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
          ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.bookingMode !== undefined && { bookingMode: dto.bookingMode }),
          ...(dto.kind !== undefined && { kind: dto.kind }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
          ...(dto.iconName !== undefined && { iconName: dto.iconName }),
          ...(dto.iconBgColor !== undefined && { iconBgColor: dto.iconBgColor }),
        },
      });

      if (cat.bookingMode === 'DIRECT' && (dto.nameAr !== undefined || dto.nameEn !== undefined)) {
        const existingHidden = await tx.service.findFirst({
          where: { categoryId: dto.categoryId, isHidden: true },
          select: { id: true },
        });
        if (existingHidden) {
          await tx.service.update({
            where: { id: existingHidden.id },
            data: { nameAr: cat.nameAr, nameEn: cat.nameEn ?? null },
          });
        }
      }

      return cat;
    });

    await this.cache.invalidatePrefix(CATEGORIES_CACHE_PREFIX);
    await this.cache.invalidatePrefix(DEPARTMENTS_CACHE_PREFIX); // departments list embeds active categories
    await this.cache.invalidatePrefix(SERVICES_CACHE_PREFIX); // DIRECT internal service name can change with category name
    await this.cache.invalidatePrefix('ref:public-catalog');

    // The persisted `imageUrl` is a bare object key; return a freshly minted
    // presigned URL so the dashboard preview reflects the saved image.
    return {
      ...category,
      imageUrl: await signMediaImageUrl(this.storage, this.mediaBucket, category.imageUrl),
    };
  }
}
