import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VerifyOtpDto } from './verify-otp.dto';

describe('VerifyOtpDto', () => {
  it('should be defined', () => {
    const dto = new VerifyOtpDto();
    expect(dto).toBeDefined();
  });

  it('accepts a 4-digit code', async () => {
    const dto = plainToInstance(VerifyOtpDto, {
      channel: 'EMAIL',
      identifier: 'user@example.com',
      code: '1234',
      purpose: 'GUEST_BOOKING',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a 6-digit code', async () => {
    const dto = plainToInstance(VerifyOtpDto, {
      channel: 'EMAIL',
      identifier: 'user@example.com',
      code: '123456',
      purpose: 'GUEST_BOOKING',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('rejects a 3-digit code', async () => {
    const dto = plainToInstance(VerifyOtpDto, {
      channel: 'EMAIL',
      identifier: 'user@example.com',
      code: '123',
      purpose: 'GUEST_BOOKING',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });
});
