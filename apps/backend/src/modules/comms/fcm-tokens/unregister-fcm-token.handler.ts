import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface UnregisterFcmTokenCommand {
  clientId: string;
  token?: string;
}

@Injectable()
export class UnregisterFcmTokenHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UnregisterFcmTokenCommand) {
    const where = cmd.token
      ? { clientId: cmd.clientId, token: cmd.token }
      : { clientId: cmd.clientId };
    const res = await this.prisma.fcmToken.deleteMany({ where });
    return { deleted: res.count };
  }
}
