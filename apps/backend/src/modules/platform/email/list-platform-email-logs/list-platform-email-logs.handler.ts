import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

export type PlatformEmailLogStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED_NOT_CONFIGURED';

export interface ListPlatformEmailLogsQuery {
  status?: PlatformEmailLogStatus;
  templateSlug?: string;
  organizationId?: string;
  cursor?: string;
  limit?: number;
}

export interface PlatformEmailLogRow {
  id: string;
  organizationId: string | null;
  templateSlug: string;
  toAddress: string;
  status: PlatformEmailLogStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  sentAt: Date | null;
}

export interface ListPlatformEmailLogsResult {
  items: PlatformEmailLogRow[];
  nextCursor: string | null;
}

type LogClient = {
  platformEmailLog: {
    findMany: (args: Record<string, unknown>) => Promise<PlatformEmailLogRow[]>;
  };
};

const MAX_LIMIT = 200;

@Injectable()
export class ListPlatformEmailLogsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(q: ListPlatformEmailLogsQuery): Promise<ListPlatformEmailLogsResult> {
    const limit = Math.min(q.limit ?? 50, MAX_LIMIT);
    const where: Record<string, unknown> = {};

    if (q.status) where.status = q.status;
    if (q.templateSlug) where.templateSlug = q.templateSlug;
    if (q.organizationId) where.organizationId = q.organizationId;
    if (q.cursor) where.id = { lt: q.cursor };

    const client = this.prisma as unknown as LogClient;
    const items = await client.platformEmailLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      items.pop();
      nextCursor = items[items.length - 1]?.id ?? null;
    }

    return { items, nextCursor };
  }
}
