import {
  CHAT_OPERATIONS_RESUME_CONSUMER_ID,
  OnChatOperationsResumeRequestedHandler,
} from './on-chat-operations-resume-requested.handler';

describe('OnChatOperationsResumeRequestedHandler', () => {
  it('uses one stable consumer identity and lets transient resume failures retry', async () => {
    const eventBus = { subscribe: jest.fn() };
    const resume = {
      execute: jest.fn()
        .mockRejectedValueOnce(new Error('quote database unavailable'))
        .mockResolvedValueOnce([]),
    };
    const handler = new OnChatOperationsResumeRequestedHandler(eventBus as never, resume as never);
    handler.register();

    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'comms.chat.operations.resume_requested',
      CHAT_OPERATIONS_RESUME_CONSUMER_ID,
      expect.any(Function),
    );
    const callback = eventBus.subscribe.mock.calls[0][2];
    const event = {
      eventId: 'event-1', source: 'comms', version: 1, occurredAt: new Date(),
      payload: { conversationId: 'conversation-1', clientId: 'client-1' },
    };

    await expect(callback(event)).rejects.toThrow('quote database unavailable');
    await expect(callback(event)).resolves.toBeUndefined();
    expect(resume.execute).toHaveBeenCalledTimes(2);
    expect(resume.execute).toHaveBeenNthCalledWith(2, event.payload);
  });
});
