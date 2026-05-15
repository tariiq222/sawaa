import 'reflect-metadata';
import { SendSmsDto } from './send-sms.dto';

describe('SendSmsDto', () => {
  it('should be defined', () => {
    const dto = new SendSmsDto();
    expect(dto).toBeDefined();
  });
});
