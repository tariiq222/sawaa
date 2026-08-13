import { ForbiddenException } from '@nestjs/common';
import { ChatMessageKind, ConversationStatus, MessageSenderType } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { GetConversationHandler } from './get-conversation.handler';
import { ListConversationMessagesHandler } from './list-conversation-messages.handler';
import { StaffConversationAccessService } from './staff-conversation-access.service';

describe('staff conversation detail and messages', () => {
  it('lets reception read unassigned waiting work but blocks another receptionist assigned conversation', async () => {
    const prisma: any = {
      chatConversation: { findUnique: jest.fn().mockResolvedValue({ id: 'conv-1', status: ConversationStatus.WAITING_FOR_STAFF, assignedStaffUserId: null }) },
    };
    const access = new StaffConversationAccessService(prisma as PrismaService);
    await expect(access.assertReadAccess('conv-1', 'staff-a', 'RECEPTIONIST')).resolves.toEqual(expect.objectContaining({ id: 'conv-1' }));
    prisma.chatConversation.findUnique.mockResolvedValue({ id: 'conv-1', status: ConversationStatus.STAFF_ACTIVE, assignedStaffUserId: 'staff-b' });
    await expect(access.assertReadAccess('conv-1', 'staff-a', 'RECEPTIONIST')).rejects.toThrow(ForbiddenException);
    await expect(access.assertReadAccess('conv-1', 'admin-a', 'ADMIN')).resolves.toEqual(expect.objectContaining({ id: 'conv-1' }));
  });

  it('returns safe detail and message projections without AI or metadata internals', async () => {
    const rawConversation = {
      id: 'conv-1', clientId: null, status: ConversationStatus.STAFF_ACTIVE, guestName: 'سارة', guestPhone: '+966501234567',
      language: 'ar', assignedStaffUserId: 'staff-a', handoffRequestedAt: null, staffClaimedAt: null, closedAt: null,
      staffUnreadCount: 1, clientUnreadCount: 0, lastMessageAt: null, createdAt: new Date(), updatedAt: new Date(),
      guestTokenHash: 'secret', assistantLeaseOwner: 'lease-secret',
    };
    const rawMessage = {
      id: 'message-1', conversationId: 'conv-1', senderType: MessageSenderType.VISITOR, senderId: null,
      body: 'مرحبا', kind: ChatMessageKind.TEXT, clientMessageId: 'm-1', createdAt: new Date(),
      metadata: { internal: true }, model: 'secret-model', tokensUsed: 999,
    };
    const prisma: any = {
      chatConversation: { findUnique: jest.fn().mockResolvedValue(rawConversation) },
      commsChatMessage: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([rawMessage]) },
    };
    const access = { assertReadAccess: jest.fn().mockResolvedValue(rawConversation) };
    const detail = new GetConversationHandler(prisma as PrismaService, access as unknown as StaffConversationAccessService);
    const messages = new ListConversationMessagesHandler(prisma as PrismaService, access as unknown as StaffConversationAccessService);

    const detailResult = await detail.execute({ conversationId: 'conv-1', staffUserId: 'staff-a', staffRole: 'RECEPTIONIST' });
    const messageResult = await messages.execute({ conversationId: 'conv-1', staffUserId: 'staff-a', staffRole: 'RECEPTIONIST', limit: 20 });

    expect(detailResult).toEqual(expect.objectContaining({ guestName: 'سارة', guestPhone: '+966501234567' }));
    expect(messageResult.data).toEqual([{
      id: 'message-1', conversationId: 'conv-1', senderType: MessageSenderType.VISITOR,
      body: 'مرحبا', kind: ChatMessageKind.TEXT, clientMessageId: 'm-1', createdAt: rawMessage.createdAt,
    }]);
    expect(JSON.stringify({ detailResult, messageResult })).not.toMatch(/secret|metadata|model|tokensUsed/);
  });
});
