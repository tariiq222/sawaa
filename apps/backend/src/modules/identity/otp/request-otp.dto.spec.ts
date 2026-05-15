import 'reflect-metadata';
import { RequestOtpDto } from './request-otp.dto';

describe('RequestOtpDto', () => {
  it('should be defined', () => {
    const dto = new RequestOtpDto();
    expect(dto).toBeDefined();
  });
});
