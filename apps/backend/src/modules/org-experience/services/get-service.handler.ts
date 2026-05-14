import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type GetServiceCommand = { serviceId: string };

@Injectable()
export class GetServiceHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: GetServiceCommand) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, archivedAt: null },
      include: {
        category: true,
        durationOptions: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }
}
