import { ChatAccessService } from './chat-access.service';
import { ClaimConversationHandler } from './claim-conversation.handler';

describe('ClaimConversationHandler', () => {
  it('requires both the client session identity and guest cookie before claiming', async () => {
    const access = { claimGuestConversation: jest.fn() };
    const handler = new ClaimConversationHandler(access as unknown as ChatAccessService);

    await expect(handler.execute({ conversationId: 'conv-1', clientId: 'client-a', guestToken: undefined })).rejects.toThrow('Guest chat cookie is required');
    expect(access.claimGuestConversation).not.toHaveBeenCalled();
  });

  it('claims through the access service using the authenticated client rather than a DTO clientId', async () => {
    const access = { claimGuestConversation: jest.fn().mockResolvedValue({ id: 'conv-1', clientId: 'client-a', guestTokenHash: null }) };
    const handler = new ClaimConversationHandler(access as unknown as ChatAccessService);

    await expect(handler.execute({ conversationId: 'conv-1', clientId: 'client-a', guestToken: 'guest-a' })).resolves.toEqual({ id: 'conv-1', clientId: 'client-a' });
  });
});
