import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { WhatsappConversationStatus } from '@prisma/client';

export interface ListWhatsappConversationsQuery {
  status?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export interface WhatsappConversationSummary {
  id: string;
  phone: string;
  clientId: string | null;
  status: string;
  language: string;
  staffTakeover: boolean;
  lastMessageAt: Date;
  messageCount: number;
  lastMessagePreview: string | null;
}

const VALID_STATUSES: WhatsappConversationStatus[] = [
  'ACTIVE',
  'COMPLETED',
  'ABANDONED',
  'TAKEOVER',
  'BLOCKED',
];

@Injectable()
export class ListWhatsappConversationsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListWhatsappConversationsQuery) {
    const where: {
      status?: { in: WhatsappConversationStatus[] };
      phone?: { contains: string };
    } = {};

    if (query.status && VALID_STATUSES.includes(query.status as WhatsappConversationStatus)) {
      where.status = { in: [query.status as WhatsappConversationStatus] };
    }
    if (query.search) {
      where.phone = { contains: query.search };
    }

    const [total, rows] = await Promise.all([
      this.prisma.whatsappConversation.count({ where }),
      this.prisma.whatsappConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const summaries: WhatsappConversationSummary[] = await Promise.all(
      rows.map(async (row) => {
        const messageCount = await this.prisma.whatsappMessage.count({
          where: { conversationId: row.id },
        });
        const lastMessage = await this.prisma.whatsappMessage.findFirst({
          where: { conversationId: row.id },
          orderBy: { createdAt: 'desc' },
          select: { content: true },
        });
        return {
          id: row.id,
          phone: row.phone,
          clientId: row.clientId,
          status: row.status,
          language: row.language,
          staffTakeover: row.staffTakeover,
          lastMessageAt: row.lastMessageAt,
          messageCount,
          lastMessagePreview: lastMessage?.content.slice(0, 120) ?? null,
        };
      }),
    );

    return {
      items: summaries,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
