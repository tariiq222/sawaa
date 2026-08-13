import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';

const ASSISTANT_LEASE_MS = 120_000;

@Injectable()
export class AdministrativeAssistantLeaseService {
  private readonly logger = new Logger(AdministrativeAssistantLeaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  async acquire(conversationId: string, owner: string): Promise<boolean> {
    const expiresAt = new Date(Date.now() + ASSISTANT_LEASE_MS);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "ChatConversation"
      SET "assistantLeaseOwner" = ${owner},
          "assistantLeaseExpiresAt" = ${expiresAt}
      WHERE "id" = ${conversationId}
        AND (
          "assistantLeaseOwner" IS NULL
          OR "assistantLeaseExpiresAt" IS NULL
          OR "assistantLeaseExpiresAt" < now()
        )
      RETURNING "id"
    `;
    return rows.length === 1;
  }

  async renew(conversationId: string, owner: string): Promise<boolean> {
    const expiresAt = new Date(Date.now() + ASSISTANT_LEASE_MS);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "ChatConversation"
      SET "assistantLeaseExpiresAt" = ${expiresAt}
      WHERE "id" = ${conversationId}
        AND "assistantLeaseOwner" = ${owner}
        AND "assistantLeaseExpiresAt" > now()
      RETURNING "id"
    `;
    return rows.length === 1;
  }

  async release(conversationId: string, owner: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        UPDATE "ChatConversation"
        SET "assistantLeaseOwner" = NULL,
            "assistantLeaseExpiresAt" = NULL
        WHERE "id" = ${conversationId}
          AND "assistantLeaseOwner" = ${owner}
      `;
    } catch {
      this.logger.warn('Could not release the owned administrative assistant lease');
    }
  }
}
