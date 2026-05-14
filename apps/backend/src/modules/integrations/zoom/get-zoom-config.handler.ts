import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class GetZoomConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute() {
    const integration = await this.prisma.integration.findFirst({
      where: { provider: 'zoom' },
    });

    if (!integration) {
      return { configured: false, isActive: false };
    }

    return {
      configured: true,
      isActive: integration.isActive,
    };
  }
}
