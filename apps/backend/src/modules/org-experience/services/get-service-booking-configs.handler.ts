import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetServiceBookingConfigsCommand {
  serviceId: string;
}

@Injectable()
export class GetServiceBookingConfigsHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: GetServiceBookingConfigsCommand) {
    const service = await this.prisma.service.findFirst({
      where: { id: cmd.serviceId },
    });
    if (!service) throw new NotFoundException('Service not found');

    const [configs, durationOptions, availabilityWindows] = await Promise.all([
      this.prisma.serviceBookingConfig.findMany({
        where: { serviceId: cmd.serviceId },
        orderBy: { deliveryType: 'asc' },
      }),
      this.prisma.serviceDurationOption.findMany({
        where: { serviceId: cmd.serviceId },
        orderBy: [{ deliveryType: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.serviceAvailabilityWindow.findMany({
        where: { serviceId: cmd.serviceId },
        orderBy: [{ deliveryType: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
    ]);

    return configs.map((config) => ({
      ...config,
      durationOptions: durationOptions.filter((option) => option.deliveryType === config.deliveryType),
      availabilityWindows: availabilityWindows.filter((window) => window.deliveryType === config.deliveryType),
    }));
  }
}
