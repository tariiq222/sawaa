import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { clientEmailStatus } from './client-email.store';
import { ClientEmailStatusDto } from './client-email.response';

@Injectable()
export class GetClientEmailStatusHandler {
  constructor(private readonly prisma: PrismaService) {}
  async execute(clientId: string): Promise<ClientEmailStatusDto> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || !client.isActive || client.deletedAt) return { status: 'none', email: null, pendingEmail: null, prompt: false };
    return clientEmailStatus(client);
  }
}
