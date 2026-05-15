import 'reflect-metadata';
import { ListConversationsDto } from './list-conversations.dto';

describe('ListConversationsDto', () => {
  it('should be defined', () => {
    const dto = new ListConversationsDto();
    expect(dto).toBeDefined();
  });
});
