import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListChatMessagesDto } from './list-chat-messages.dto';

describe('ListChatMessagesDto', () => {
  it('limits web-chat pagination to 100 records without changing the legacy dashboard DTO', async () => {
    const accepted = await validate(plainToInstance(ListChatMessagesDto, { limit: '100' }));
    const rejected = await validate(plainToInstance(ListChatMessagesDto, { limit: '101' }));

    expect(accepted).toEqual([]);
    expect(rejected.some((error) => error.property === 'limit')).toBe(true);
  });
});
