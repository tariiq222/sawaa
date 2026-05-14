import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { SetDurationOptionsDto } from './set-duration-options.dto';

export type SetDurationOptionsCommand = SetDurationOptionsDto & { serviceId: string };

@Injectable()
export class SetDurationOptionsHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: SetDurationOptionsCommand) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId },
    });
    if (!service) throw new NotFoundException('Service not found');

    await this.prisma.$transaction((tx) =>
      Promise.all(dto.options.map((opt) =>
        opt.id
          ? tx.serviceDurationOption.update({
              where: { id: opt.id },
              data: {
                bookingType: opt.bookingType ?? null,
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
                bookingType: opt.bookingType ?? null,
                label: opt.label,
                labelAr: opt.labelAr,
                durationMins: opt.durationMins,
                price: opt.price,
                currency: opt.currency ?? 'SAR',
                isDefault: opt.isDefault ?? false,
                sortOrder: opt.sortOrder ?? 0,
              },
            }),
      )),
    );

    return this.prisma.serviceDurationOption.findMany({
      where: { serviceId: dto.serviceId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }
}
