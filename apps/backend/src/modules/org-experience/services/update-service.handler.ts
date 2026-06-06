import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { EventBusService } from '../../../infrastructure/events';
import { ServiceDeactivatedEvent } from '../events/service-deactivated.event';
import { ServiceReactivatedEvent } from '../events/service-reactivated.event';
import { UpdateServiceDto } from './update-service.dto';
import { SERVICES_CACHE_PREFIX } from './services.cache';

export type UpdateServiceCommand = UpdateServiceDto & { serviceId: string };

@Injectable()
export class UpdateServiceHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: UpdateServiceCommand) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, archivedAt: null },
    });
    if (!service) throw new NotFoundException('Service not found');

    // Merge incoming values with existing for cross-field constraint validation
    const effectivePrice = dto.price ?? Number(service.price);
    const effectiveMin = dto.minParticipants ?? service.minParticipants;
    const effectiveMax = dto.maxParticipants ?? service.maxParticipants;
    const effectiveDepositEnabled = dto.depositEnabled ?? service.depositEnabled;
    const effectiveDepositAmount =
      dto.depositAmount !== undefined ? dto.depositAmount : service.depositAmount ? Number(service.depositAmount) : undefined;

    if (
      effectiveDepositEnabled &&
      effectiveDepositAmount !== undefined &&
      effectiveDepositAmount > effectivePrice
    ) {
      throw new BadRequestException('depositAmount must not exceed the service price');
    }

    if (effectiveMin > effectiveMax) {
      throw new BadRequestException('minParticipants must not exceed maxParticipants');
    }

    const effectiveReserve = dto.reserveWithoutPayment ?? service.reserveWithoutPayment;
    if (effectiveReserve && effectiveMax <= 1) {
      throw new BadRequestException('reserveWithoutPayment requires maxParticipants > 1');
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
        // التكرار
        allowRecurring: dto.allowRecurring,
        allowedRecurringPatterns: dto.allowedRecurringPatterns,
        maxRecurrences: dto.maxRecurrences,
        // الجلسات الجماعية
        minParticipants: dto.minParticipants,
        maxParticipants: dto.maxParticipants,
        reserveWithoutPayment: dto.reserveWithoutPayment,
      },
      include: {
        category: true,
        durationOptions: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await this.cache.invalidatePrefix(SERVICES_CACHE_PREFIX);

    if (dto.isActive !== undefined && dto.isActive !== wasActive) {
      const event = dto.isActive
        ? new ServiceReactivatedEvent({ serviceId: updated.id })
        : new ServiceDeactivatedEvent({ serviceId: updated.id });
      await this.eventBus.publish(event.eventName, event.toEnvelope()).catch(() => undefined);
    }

    return updated;
  }
}
