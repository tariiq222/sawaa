import { StaffReplyHandler } from './staff-reply.handler';

describe('StaffReplyHandler', () => {
  it('activates takeover before sending the staff message', async () => {
    const update = jest.fn().mockResolvedValue({});
    const create = jest.fn().mockResolvedValue({ id: 'message-1' });
    const sendText = jest.fn().mockResolvedValue({ ok: true, messageId: 'out-1' });
    const handler = new StaffReplyHandler(
      {
        whatsappConversation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'conversation-1',
            phone: '+966500000000',
          }),
          update,
        },
         whatsappMessage: { create, update: jest.fn().mockResolvedValue({}) },
      } as never,
      { resolve: jest.fn().mockResolvedValue({ client: { sendText } }) } as never,
    );

    await handler.execute('conversation-1', 'staff-1', { message: 'Hello' });

    expect(update.mock.invocationCallOrder[0]).toBeLessThan(sendText.mock.invocationCallOrder[0]);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ deliveryStatus: 'PENDING' }),
    });
  });
});
