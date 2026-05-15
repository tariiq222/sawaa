import 'reflect-metadata';
import { RequestMobileLoginOtpDto } from './request-mobile-login-otp.dto';

describe('RequestMobileLoginOtpDto', () => {
  it('should be defined', () => {
    const dto = new RequestMobileLoginOtpDto();
    expect(dto).toBeDefined();
  });
});
