import 'reflect-metadata';
import { SendTestEmailDto } from './send-test-email.dto';

describe('SendTestEmailDto', () => {
  it('should be defined', () => {
    const dto = new SendTestEmailDto();
    expect(dto).toBeDefined();
  });
});
