import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { RegisterFcmTokenDto } from './register-fcm-token.dto';

export type RegisterFcmTokenCommand = RegisterFcmTokenDto & { clientId: string };

@Injectable()
export class RegisterFcmTokenHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: RegisterFcmTokenCommand) {
    const client = await this.prisma.client.findFirst({
      where: { id: cmd.clientId, deletedAt: null },
      select: { id: true, organizationId: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    return this.prisma.fcmToken.upsert({
      where: { fcm_token_per_client: { clientId: cmd.clientId, token: cmd.token } },
      create: {
        clientId: cmd.clientId,
        token: cmd.token,
        platform: cmd.platform,
      },
      update: { platform: cmd.platform, lastSeenAt: new Date() },
    });
  }
}
