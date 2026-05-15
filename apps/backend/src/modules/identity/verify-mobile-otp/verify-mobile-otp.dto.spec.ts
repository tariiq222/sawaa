import 'reflect-metadata';
import { VerifyMobileOtpDto } from './verify-mobile-otp.dto';

describe('VerifyMobileOtpDto', () => {
  it('should be defined', () => {
    const dto = new VerifyMobileOtpDto();
    expect(dto).toBeDefined();
  });
});
