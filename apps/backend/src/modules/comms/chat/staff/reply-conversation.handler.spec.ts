import { SendChatMessageHandler } from '../messages/send-chat-message.handler';
import { ReplyConversationHandler } from './reply-conversation.handler';

describe('ReplyConversationHandler', () => {
  it('reuses the Task 3 message path with JWT staff identity and no caller sender fields', async () => {
    const messages = { execute: jest.fn().mockResolvedValue({ id: 'message-1' }) };
    const handler = new ReplyConversationHandler(messages as unknown as SendChatMessageHandler);

    await handler.execute({ conversationId: 'conv-1', staffUserId: 'staff-a', body: ' أهلًا ', clientMessageId: 'staff-msg-1' });

    expect(messages.execute).toHaveBeenCalledWith({
      audience: 'staff',
      conversationId: 'conv-1',
      staffUserId: 'staff-a',
      body: ' أهلًا ',
      clientMessageId: 'staff-msg-1',
    });
  });
});
