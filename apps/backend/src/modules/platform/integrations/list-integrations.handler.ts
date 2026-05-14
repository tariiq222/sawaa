import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class ListIntegrationsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    return this.prisma.integration.findMany({
      where: { isActive: true },
      orderBy: { provider: 'asc' },
    });
  }
}
