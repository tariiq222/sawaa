import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class ListSmsDeliveriesHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute() {
    const rows = await this.prisma.smsDelivery.findMany({
      where: {},
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        provider: true,
        toPhone: true,
        status: true,
        providerMessageId: true,
        errorMessage: true,
        sentAt: true,
        deliveredAt: true,
        createdAt: true,
      },
    });
    return { items: rows };
  }
}
