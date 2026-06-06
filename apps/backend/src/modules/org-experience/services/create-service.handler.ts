import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { EventBusService } from '../../../infrastructure/events';
import { ServiceCreatedEvent } from '../events/service-created.event';
import { CreateServiceDto } from './create-service.dto';
import { SERVICES_CACHE_PREFIX } from './services.cache';

export type CreateServiceCommand = CreateServiceDto;

@Injectable()
export class CreateServiceHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: CreateServiceCommand) {
    this.validateBusinessRules(dto);

    const existing = await this.prisma.service.findFirst({
      where: { nameAr: dto.nameAr, archivedAt: null },
    });
    if (existing) throw new ConflictException('Service with this Arabic name already exists');

    const service = await this.prisma.service.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        descriptionAr: dto.descriptionAr,
        descriptionEn: dto.descriptionEn,
        durationMins: dto.durationMins,
        price: dto.price,
        currency: dto.currency ?? 'SAR',
        imageUrl: dto.imageUrl,
        categoryId: dto.categoryId,
        // العرض/الإخفاء
        isActive: dto.isActive ?? true,
        isHidden: dto.isHidden ?? false,
        hidePriceOnBooking: dto.hidePriceOnBooking ?? false,
        hideDurationOnBooking: dto.hideDurationOnBooking ?? false,
        // الهوية البصرية
        iconName: dto.iconName,
        iconBgColor: dto.iconBgColor,
        // قواعد الجدولة
        bufferMinutes: dto.bufferMinutes ?? 0,
        minLeadMinutes: dto.minLeadMinutes,
        maxAdvanceDays: dto.maxAdvanceDays,
        // العربون
        depositEnabled: dto.depositEnabled ?? false,
        depositAmount: dto.depositAmount,
        // التكرار
        allowRecurring: dto.allowRecurring ?? false,
        allowedRecurringPatterns: dto.allowedRecurringPatterns ?? [],
        maxRecurrences: dto.maxRecurrences,
        // الجلسات الجماعية
        minParticipants: dto.minParticipants ?? 1,
        maxParticipants: dto.maxParticipants ?? 1,
        reserveWithoutPayment: dto.reserveWithoutPayment ?? false,
      },
      include: {
        category: true,
        durationOptions: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await this.cache.invalidatePrefix(SERVICES_CACHE_PREFIX);

    const event = new ServiceCreatedEvent({ serviceId: service.id });
    this.eventBus.publish(event.eventName, event.toEnvelope()).catch(() => {});

    return service;
  }

  private validateBusinessRules(dto: CreateServiceCommand): void {
    if (
      dto.depositEnabled &&
      dto.depositAmount !== undefined &&
      dto.depositAmount > dto.price
    ) {
      throw new BadRequestException('depositAmount must not exceed the service price');
    }

    const min = dto.minParticipants ?? 1;
    const max = dto.maxParticipants ?? 1;
    if (min > max) {
      throw new BadRequestException('minParticipants must not exceed maxParticipants');
    }

    if (dto.reserveWithoutPayment && max <= 1) {
      throw new BadRequestException('reserveWithoutPayment requires maxParticipants > 1');
    }
  }
}
