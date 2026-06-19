import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { parseEntityRef } from '../../../common/parse-entity-ref';

export type GetServiceCommand = { serviceId: string };

@Injectable()
export class GetServiceHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: GetServiceCommand) {
    const idf = parseEntityRef(dto.serviceId, 'SVC');
    const service = await this.prisma.service.findFirst({
      where: { ...(idf.kind === 'uuid' ? { id: idf.id } : { ref: idf.ref }), archivedAt: null },
      include: {
        category: true,
        durationOptions: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }
}
