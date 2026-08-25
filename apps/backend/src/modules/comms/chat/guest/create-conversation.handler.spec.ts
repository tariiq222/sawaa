import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { CreateGuestConversationHandler } from './create-conversation.handler';
import { GuestChatTokenService } from './guest-chat-token.service';

describe('CreateGuestConversationHandler', () => {
  it('stores only the HMAC token hash and keeps the raw token for the HTTP cookie boundary', async () => {
    const prisma = { chatConversation: { create: jest.fn().mockResolvedValue({ id: 'conv-1', guestTokenHash: 'hmac', isAiChat: true, status: ConversationStatus.AI_ACTIVE }) } };
    const tokens = { issue: jest.fn().mockReturnValue({ rawToken: 'raw-guest-token', tokenHash: 'hmac' }) };
    const handler = new CreateGuestConversationHandler(prisma as unknown as PrismaService, tokens as unknown as GuestChatTokenService);

    const result = await handler.execute({ guestName: 'Guest A', guestPhone: '+966500000001', language: 'ar' });

    expect(prisma.chatConversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: null,
        guestTokenHash: 'hmac',
        guestName: 'Guest A',
        guestPhone: '+966500000001',
        language: 'ar',
        isAiChat: true,
        status: ConversationStatus.AI_ACTIVE,
      }),
    });
    expect(result).toEqual(expect.objectContaining({ guestToken: 'raw-guest-token' }));
  });
});
