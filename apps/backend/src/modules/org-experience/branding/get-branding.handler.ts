import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class GetBrandingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    const row = await this.prisma.brandingConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (row) return row;
    return this.prisma.brandingConfig.create({
      data: { organizationNameAr: 'منظمتي' },
    });
  }
}
