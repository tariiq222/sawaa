import { Injectable, NotFoundException } from '@nestjs/common';
import { ContactMessageStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface UpdateContactMessageStatusCommand {
  id: string;
  status: ContactMessageStatus;
}

@Injectable()
export class UpdateContactMessageStatusHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateContactMessageStatusCommand) {
    // SaaS-02f: findFirst (not findUnique) so the Proxy auto-scopes by org;
    // prevents cross-org id probes from returning foreign rows.
    const existing = await this.prisma.contactMessage.findFirst({ where: { id: cmd.id } });
    if (!existing) throw new NotFoundException('Contact message not found');

    const now = new Date();
    return this.prisma.contactMessage.update({
      where: { id: cmd.id },
      data: {
        status: cmd.status,
        ...(cmd.status === 'READ' && !existing.readAt ? { readAt: now } : {}),
        ...(cmd.status === 'ARCHIVED' ? { archivedAt: now } : {}),
      },
    });
  }
}
