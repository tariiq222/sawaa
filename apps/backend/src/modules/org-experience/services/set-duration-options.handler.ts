import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { SetDurationOptionsDto } from './set-duration-options.dto';
import { normalizeDeliveryTypeInput } from './delivery-type-input.helper';

export type SetDurationOptionsCommand = SetDurationOptionsDto & { serviceId: string };

@Injectable()
export class SetDurationOptionsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(dto: SetDurationOptionsCommand) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId },
    });
    if (!service) throw new NotFoundException('Service not found');

    // Ownership guard: every provided option id must belong to this service,
    // otherwise an update could mutate a duration option of a different service.
    const updateIds = dto.options.map((o) => o.id).filter((id): id is string => !!id);
    if (updateIds.length > 0) {
      const owned = await this.prisma.serviceDurationOption.findMany({
        where: { id: { in: updateIds }, serviceId: dto.serviceId },
        select: { id: true },
      });
      if (owned.length !== updateIds.length) {
        throw new NotFoundException('Duration option not found for this service');
      }
    }

    await this.rlsTransaction.withTransaction((tx) =>
      Promise.all(
        dto.options.map((opt) => {
          const deliveryType = normalizeDeliveryTypeInput(opt.deliveryType);
          return opt.id
            ? tx.serviceDurationOption.update({
                where: { id: opt.id },
                data: {
                  deliveryType,
                  label: opt.label,
                  labelAr: opt.labelAr,
                  durationMins: opt.durationMins,
                  price: opt.price,
                  currency: opt.currency ?? 'SAR',
                  isDefault: opt.isDefault ?? false,
                  sortOrder: opt.sortOrder ?? 0,
                  ...(opt.isActive !== undefined && { isActive: opt.isActive }),
                },
              })
            : tx.serviceDurationOption.create({
                data: {
                  serviceId: dto.serviceId,
                  deliveryType,
                  label: opt.label,
                  labelAr: opt.labelAr,
                  durationMins: opt.durationMins,
                  price: opt.price,
                  currency: opt.currency ?? 'SAR',
                  isDefault: opt.isDefault ?? false,
                  sortOrder: opt.sortOrder ?? 0,
                },
              });
        }),
      ),
    );

    return this.prisma.serviceDurationOption.findMany({
      where: { serviceId: dto.serviceId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
