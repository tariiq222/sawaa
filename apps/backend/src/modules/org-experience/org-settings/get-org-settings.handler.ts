import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class GetOrgSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    return this.prisma.organizationSettings.findFirst({
      orderBy: { createdAt: 'desc' },
    });
  }
}
