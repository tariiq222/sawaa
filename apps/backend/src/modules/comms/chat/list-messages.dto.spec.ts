import 'reflect-metadata';
import { ListMessagesDto } from './list-messages.dto';

describe('ListMessagesDto', () => {
  it('should be defined', () => {
    const dto = new ListMessagesDto();
    expect(dto).toBeDefined();
  });
});
