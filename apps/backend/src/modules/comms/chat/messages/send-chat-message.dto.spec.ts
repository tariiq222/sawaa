import { validate } from 'class-validator';
import { SendChatMessageDto } from './send-chat-message.dto';

describe('SendChatMessageDto', () => {
  it('requires a body and an opaque client message identifier without accepting caller-controlled sender fields', async () => {
    const dto = Object.assign(new SendChatMessageDto(), {
      body: '',
      clientMessageId: '',
      senderType: 'AI',
    });

    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['body', 'clientMessageId', 'senderType']));
  });

  it('accepts a UUID client message identifier', async () => {
    const dto = Object.assign(new SendChatMessageDto(), {
      body: 'مرحبا',
      clientMessageId: '00000000-0000-4000-a000-000000000001',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });
});
