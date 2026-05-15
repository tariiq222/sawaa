import 'reflect-metadata';
import { RequestDashboardOtpDto } from './request-dashboard-otp.dto';

describe('RequestDashboardOtpDto', () => {
  it('should be defined', () => {
    const dto = new RequestDashboardOtpDto();
    expect(dto).toBeDefined();
  });
});
