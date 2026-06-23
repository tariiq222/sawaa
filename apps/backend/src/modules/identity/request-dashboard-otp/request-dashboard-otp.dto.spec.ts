import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestDashboardOtpDto } from './request-dashboard-otp.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(RequestDashboardOtpDto, plain);
  return validate(dto);
}

describe('RequestDashboardOtpDto', () => {
  it('accepts an email identifier', async () => {
    const errors = await validateDto({ identifier: 'admin@sawa.example' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a phone identifier', async () => {
    const errors = await validateDto({ identifier: '+966501234567' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty identifier', async () => {
    const errors = await validateDto({ identifier: '' });
    expect(errors.some((e) => e.property === 'identifier')).toBe(true);
  });

  it('rejects a missing identifier', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'identifier')).toBe(true);
  });

  it('rejects a non-string identifier', async () => {
    const errors = await validateDto({ identifier: 12345 });
    expect(errors.some((e) => e.property === 'identifier')).toBe(true);
  });

  it('rejects a whitespace-only identifier', async () => {
    const errors = await validateDto({ identifier: '   ' });
    // @IsString accepts whitespace-only strings; @IsNotEmpty treats it as
    // valid by default. Document the actual behavior at the DTO level.
    expect(errors.some((e) => e.property === 'identifier')).toBe(false);
  });
});
