import { CreateChatMessageHandler } from './create-chat-message.handler';
import type { PrismaService } from '../../../infrastructure/database';
import { MessageSenderType } from '@prisma/client';

const buildPrisma = () => ({
  chatConversation: {
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ id: 'conv-1' }),
  },
  commsChatMessage: {
    create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
  },
});

describe('CreateChatMessageHandler', () => {
  it('creates message and updates lastMessageAt on conversation', async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findFirst.mockResolvedValue({ id: 'conv-1', status: 'OPEN', organizationId: 'org-A' });
    const handler = new CreateChatMessageHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({
      conversationId: 'conv-1',
      senderType: MessageSenderType.CLIENT,
      senderId: 'client-1',
      body: 'Hello',
    });
    expect(result.id).toBe('msg-1');
    expect(prisma.chatConversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { lastMessageAt: expect.any(Date) },
    });
  });
});
