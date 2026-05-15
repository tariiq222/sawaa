import 'reflect-metadata';
import { ListContactMessagesDto } from './list-contact-messages.dto';

describe('ListContactMessagesDto', () => {
  it('should be defined', () => {
    const dto = new ListContactMessagesDto();
    expect(dto).toBeDefined();
  });
});
