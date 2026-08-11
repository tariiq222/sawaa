import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class ReleaseWhatsappTakeoverHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string) {
    const conversation = await this.prisma.whatsappConversation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    await this.prisma.whatsappConversation.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        staffTakeover: false,
        staffUserId: null,
        staffTookOverAt: null,
      },
    });

    return { released: true };
  }
}
