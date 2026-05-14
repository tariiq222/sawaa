import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetClientPushTargetsCommand {
  clientId: string;
}

export interface ClientPushTargets {
  pushEnabled: boolean;
  tokens: string[];
}

@Injectable()
export class GetClientPushTargetsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: GetClientPushTargetsCommand): Promise<ClientPushTargets> {
    const client = await this.prisma.client.findFirst({
      where: { id: cmd.clientId, deletedAt: null },
      select: { id: true, pushEnabled: true },
    });
    if (!client || !client.pushEnabled) {
      return { pushEnabled: client?.pushEnabled ?? false, tokens: [] };
    }
    const rows = await this.prisma.fcmToken.findMany({
      where: { clientId: cmd.clientId },
      select: { token: true },
    });
    return { pushEnabled: true, tokens: rows.map((r) => r.token) };
  }
}
