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

    return this.prisma.service.update({
      where: { id: dto.serviceId },
      data: { archivedAt: new Date(), isActive: false },
    });
  }
}
