import 'reflect-metadata';
import { CreateContactMessageDto } from './create-contact-message.dto';

describe('CreateContactMessageDto', () => {
  it('should be defined', () => {
    const dto = new CreateContactMessageDto();
    expect(dto).toBeDefined();
  });
});
