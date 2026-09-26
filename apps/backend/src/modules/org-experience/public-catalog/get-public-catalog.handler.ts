import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../infrastructure/cache';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { signMediaImageUrl } from '../../media/media-image-url.helper';

@Injectable()
export class GetPublicCatalogHandler {
  private readonly mediaBucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly storage: MinioService,
    config: ConfigService,
  ) {
    this.mediaBucket = config.getOrThrow<string>('MINIO_BUCKET');
  }

  async execute(options: { includeDirectClinics?: boolean } = {}) {
    const includeDirectClinics = options.includeDirectClinics === true;
    const cacheKey = includeDirectClinics ? 'ref:public-catalog:direct-clinics' : 'ref:public-catalog';
    const catalog = await this.cache.getOrSet(cacheKey, async () => {
      const [departments, categories, rawServices, orgSettings] = await Promise.all([
        this.prisma.department.findMany({
          where: { isActive: true, isVisible: true },
          orderBy: { sortOrder: 'asc' },
        }),
        this.prisma.serviceCategory.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        }),
        this.prisma.service.findMany({
          where: includeDirectClinics
            ? {
                isActive: true,
                archivedAt: null,
                OR: [
                  { isHidden: false },
                  { isHidden: true, category: { isActive: true, bookingMode: 'DIRECT' } },
                ],
              }
            : { isActive: true, isHidden: false, archivedAt: null },
          select: {
            id: true,
            categoryId: true,
            isHidden: true,
            nameAr: true,
            nameEn: true,
            descriptionAr: true,
            descriptionEn: true,
            durationMins: true,
            price: true,
            currency: true,
            imageUrl: true,
            iconName: true,
            iconBgColor: true,
            hidePriceOnBooking: true,
            hideDurationOnBooking: true,
            durationOptions: {
              where: { isActive: true, employeeServiceId: null },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                label: true,
                durationMins: true,
                price: true,
                sortOrder: true,
              },
            },
            bookingConfigs: {
              where: { isActive: true },
              select: {
                id: true,
                deliveryType: true,
                price: true,
                durationMins: true,
              },
            },
          },
          orderBy: { nameAr: 'asc' },
        }),
        this.prisma.organizationSettings.findFirst({
          where: {},
          select: { vatRate: true },
        }),
      ]);

      const vatRate = Number(orgSettings?.vatRate?.toString() ?? '0');
      const services = rawServices.map(
        ({ isHidden, hidePriceOnBooking, hideDurationOnBooking, ...service }) => ({
          ...service,
          ...(includeDirectClinics ? { isHidden } : {}),
          showPrice: !hidePriceOnBooking,
          showDuration: !hideDurationOnBooking,
        }),
      );

      return { departments, categories, services, vatRate };
    }, 300);

    const [categories, services] = await Promise.all([
      Promise.all(
        catalog.categories.map(async (category) => ({
          ...category,
          imageUrl: await signMediaImageUrl(this.storage, this.mediaBucket, category.imageUrl),
        })),
      ),
      Promise.all(
        catalog.services.map(async (service) => ({
          ...service,
          imageUrl: await signMediaImageUrl(this.storage, this.mediaBucket, service.imageUrl),
        })),
      ),
    ]);

    return { ...catalog, categories, services };
  }
}
