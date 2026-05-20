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
