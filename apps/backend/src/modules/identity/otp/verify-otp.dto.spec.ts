import 'reflect-metadata';
import { VerifyOtpDto } from './verify-otp.dto';

describe('VerifyOtpDto', () => {
  it('should be defined', () => {
    const dto = new VerifyOtpDto();
    expect(dto).toBeDefined();
  });
});
