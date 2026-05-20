import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type ArchiveServiceCommand = { serviceId: string };

@Injectable()
export class ArchiveServiceHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: ArchiveServiceCommand) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, archivedAt: null },
    });
    if (!service) throw new NotFoundException('Service not found');

    const bookingCount = await this.prisma.booking.count({
      where: { serviceId: dto.serviceId },
    });

    if (bookingCount === 0) {
      return this.prisma.$transaction(async (tx) => {
        await tx.employeeService.deleteMany({
          where: { serviceId: dto.serviceId },
        });
        await tx.serviceBundleItem.deleteMany({
          where: { serviceId: dto.serviceId },
        });
        return tx.service.delete({
          where: { id: dto.serviceId },
        });
      });
    }

    return this.prisma.service.update({
      where: { id: dto.serviceId },
      data: { archivedAt: new Date(), isActive: false },
    });
  }
}
