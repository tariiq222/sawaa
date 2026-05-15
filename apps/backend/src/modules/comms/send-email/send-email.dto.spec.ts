import 'reflect-metadata';
import { SendEmailDto } from './send-email.dto';

describe('SendEmailDto', () => {
  it('should be defined', () => {
    const dto = new SendEmailDto();
    expect(dto).toBeDefined();
  });
});
