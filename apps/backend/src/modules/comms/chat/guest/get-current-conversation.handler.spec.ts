import { ChatAccessService } from './chat-access.service';
import { GetCurrentConversationHandler } from './get-current-conversation.handler';

describe('GetCurrentConversationHandler', () => {
  const conversation = { id: 'conv-1', guestTokenHash: 'hmac', guestName: 'Guest A', guestPhone: '+966500000001', clientId: null };

  it('returns a guest current conversation without disclosing its access token hash or identity material', async () => {
    const access = { getCurrentForGuest: jest.fn().mockResolvedValue(conversation), getCurrentForClient: jest.fn() };
    const handler = new GetCurrentConversationHandler(access as unknown as ChatAccessService);

    await expect(handler.execute({ guestToken: 'guest-a' })).resolves.toEqual({ id: 'conv-1', clientId: null });
  });

  it('looks up a claimed conversation using only the authenticated client identity', async () => {
    const access = { getCurrentForGuest: jest.fn(), getCurrentForClient: jest.fn().mockResolvedValue({ ...conversation, clientId: 'client-a', guestTokenHash: null }) };
    const handler = new GetCurrentConversationHandler(access as unknown as ChatAccessService);

    await expect(handler.execute({ clientId: 'client-a' })).resolves.toEqual({ id: 'conv-1', clientId: 'client-a' });
  });
});
