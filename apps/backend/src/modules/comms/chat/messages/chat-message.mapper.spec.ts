import { MessageSenderType } from '@prisma/client';
import { toChatMessageResponse } from './chat-message.mapper';

describe('toChatMessageResponse', () => {
  it('maps only public message fields and never exposes AI metadata or accounting fields', () => {
    const response = toChatMessageResponse({
      id: 'message-1',
      conversationId: 'conversation-1',
      senderType: MessageSenderType.AI,
      senderId: 'staff-internal-id',
      body: 'كيف يمكنني مساعدتك؟',
      kind: 'TEXT',
      clientMessageId: 'client-message-1',
      createdAt: new Date('2026-08-13T10:00:00.000Z'),
      metadata: { providerTrace: 'private' },
      model: 'private-model',
      tokensUsed: 123,
      latencyMs: 50,
      responseForMessageId: 'message-0',
      isRead: false,
      readAt: null,
    });

    expect(response).toEqual({
      id: 'message-1',
      conversationId: 'conversation-1',
      senderType: MessageSenderType.AI,
      body: 'كيف يمكنني مساعدتك؟',
      kind: 'TEXT',
      clientMessageId: 'client-message-1',
      createdAt: new Date('2026-08-13T10:00:00.000Z'),
    });
    expect(response).not.toHaveProperty('senderId');
  });
});
