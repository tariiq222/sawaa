import 'reflect-metadata';
import { VerifyDashboardOtpDto } from './verify-dashboard-otp.dto';

describe('VerifyDashboardOtpDto', () => {
  it('should be defined', () => {
    const dto = new VerifyDashboardOtpDto();
    expect(dto).toBeDefined();
  });
});
