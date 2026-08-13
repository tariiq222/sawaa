import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import {
  STAFF_CONVERSATION_SELECT,
  toStaffConversationResponse,
  type StaffConversationResponse,
} from './staff-conversation.mapper';

export type InboxAssignmentFilter = 'all' | 'me' | 'unassigned';

export interface ListInboxCommand {
  staffUserId: string;
  limit: number;
  cursor?: string;
  status?: ConversationStatus;
  unreadOnly?: boolean;
  assigned?: InboxAssignmentFilter;
  search?: string;
  from?: Date;
  to?: Date;
}

export interface ListInboxResult {
  data: StaffConversationResponse[];
  meta: { limit: number; nextCursor: string | null; hasMore: boolean };
}

@Injectable()
export class ListInboxHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ListInboxCommand): Promise<ListInboxResult> {
    const search = command.search?.trim();
    const where: Prisma.ChatConversationWhereInput = {
      ...(command.status ? { status: command.status } : {}),
      ...(command.unreadOnly ? { staffUnreadCount: { gt: 0 } } : {}),
      ...(command.assigned === 'me' ? { assignedStaffUserId: command.staffUserId } : {}),
      ...(command.assigned === 'unassigned' ? { assignedStaffUserId: null } : {}),
      ...(search ? {
        OR: [
          { guestName: { contains: search, mode: 'insensitive' } },
          { guestPhone: { contains: search } },
        ],
      } : {}),
      ...(command.from || command.to ? {
        createdAt: {
          ...(command.from ? { gte: command.from } : {}),
          ...(command.to ? { lte: command.to } : {}),
        },
      } : {}),
    };

    if (command.cursor) {
      const cursor = await this.prisma.chatConversation.findFirst({
        where: { ...where, id: command.cursor },
        select: { id: true },
      });
      if (!cursor) throw new NotFoundException('Conversation cursor not found');
    }

    const limit = Math.min(Math.max(command.limit, 1), 100);
    const rows = await this.prisma.chatConversation.findMany({
      where,
      select: STAFF_CONVERSATION_SELECT,
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      ...(command.cursor ? { cursor: { id: command.cursor }, skip: 1 } : {}),
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const data = (hasMore ? rows.slice(0, limit) : rows).map(toStaffConversationResponse);
    return {
      data,
      meta: { limit, hasMore, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null },
    };
  }
}
