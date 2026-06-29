import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { signMediaImageUrl } from '../../media/media-image-url.helper';
import { EventBusService } from '../../../infrastructure/events';
import { ServiceDeactivatedEvent } from '../events/service-deactivated.event';
import { ServiceReactivatedEvent } from '../events/service-reactivated.event';
import { UpdateServiceDto } from './update-service.dto';
import { SERVICES_CACHE_PREFIX } from './services.cache';

export type UpdateServiceCommand = UpdateServiceDto & { serviceId: string };

@Injectable()
export class UpdateServiceHandler {
  private readonly mediaBucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly cache: CacheService,
    private readonly storage: MinioService,
    config: ConfigService,
  ) {
    this.mediaBucket = config.getOrThrow<string>('MINIO_BUCKET');
  }

  async execute(dto: UpdateServiceCommand) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, archivedAt: null },
    });
    if (!service) throw new NotFoundException('Service not found');

    if (dto.expectedUpdatedAt !== undefined) {
      const expected = new Date(dto.expectedUpdatedAt).getTime();
      if (expected !== service.updatedAt.getTime()) {
        throw new ConflictException('Service was modified by someone else. Refresh and try again.');
      }
    }

    // Merge incoming values with existing for cross-field constraint validation
    const effectivePrice = dto.price ?? Number(service.price);
    const effectiveDepositEnabled = dto.depositEnabled ?? service.depositEnabled;
    const effectiveDepositAmount =
      dto.depositAmount !== undefined ? dto.depositAmount : service.depositAmount ? Number(service.depositAmount) : undefined;

    if (effectiveDepositEnabled && (!effectiveDepositAmount || effectiveDepositAmount <= 0)) {
      throw new BadRequestException('depositAmount must be greater than zero when deposit is enabled');
    }

    if (
      effectiveDepositEnabled &&
      effectiveDepositAmount !== undefined &&
      effectiveDepositAmount > effectivePrice
    ) {
      throw new BadRequestException('depositAmount must not exceed the service price');
    }

    const duplicateChecks = [
      ...(dto.nameAr !== undefined ? [{ nameAr: dto.nameAr }] : []),
      ...(dto.nameEn !== undefined ? [{ nameEn: dto.nameEn }] : []),
    ];
    if (duplicateChecks.length > 0) {
      const duplicate = await this.prisma.service.findFirst({
        where: {
          id: { not: dto.serviceId },
          archivedAt: null,
          OR: duplicateChecks,
        },
      });
      if (duplicate) {
        throw new ConflictException('Service with this Arabic or English name already exists');
      }
    }

    const wasActive = service.isActive;
    const updated = await this.prisma.service.update({
      where: { id: dto.serviceId },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        durationMins: dto.durationMins,
        price: dto.price,
        currency: dto.currency,
        imageUrl: dto.imageUrl,
        categoryId: dto.categoryId,
        // العرض/الإخفاء
        isActive: dto.isActive,
        isHidden: dto.isHidden,
        hidePriceOnBooking: dto.hidePriceOnBooking,
        hideDurationOnBooking: dto.hideDurationOnBooking,
        // الهوية البصرية
        iconName: dto.iconName,
        iconBgColor: dto.iconBgColor,
        // قواعد الجدولة
        bufferMinutes: dto.bufferMinutes,
        minLeadMinutes: dto.minLeadMinutes,
        maxAdvanceDays: dto.maxAdvanceDays,
        // العربون
        depositEnabled: dto.depositEnabled,
        depositAmount: dto.depositAmount,
      },
      include: {
        category: true,
        durationOptions: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await this.cache.invalidatePrefix(SERVICES_CACHE_PREFIX);
    await this.cache.invalidatePrefix('ref:public-catalog');

    if (dto.isActive !== undefined && dto.isActive !== wasActive) {
      const event = dto.isActive
        ? new ServiceReactivatedEvent({ serviceId: updated.id })
        : new ServiceDeactivatedEvent({ serviceId: updated.id });
      await this.eventBus.publish(event.eventName, event.toEnvelope()).catch(() => undefined);
    }

    // Sign the stored image keys at read time (audit D.1).
    return {
      ...updated,
      imageUrl: await signMediaImageUrl(this.storage, this.mediaBucket, updated.imageUrl),
      category: updated.category
        ? { ...updated.category, imageUrl: await signMediaImageUrl(this.storage, this.mediaBucket, updated.category.imageUrl) }
        : updated.category,
    };
  }
}
