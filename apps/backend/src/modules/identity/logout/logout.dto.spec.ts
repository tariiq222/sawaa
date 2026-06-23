import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LogoutDto } from './logout.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(LogoutDto, plain);
  return validate(dto);
}

describe('LogoutDto', () => {
  it('accepts an empty payload (cookie-based clients omit the field)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a string refresh token', async () => {
    const errors = await validateDto({ refreshToken: 'eyJhbGciOiJIUzI1NiJ9.payload.sig' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a numeric refresh token', async () => {
    const errors = await validateDto({ refreshToken: 12345 });
    expect(errors.some((e) => e.property === 'refreshToken')).toBe(true);
  });

  it('rejects a boolean refresh token', async () => {
    const errors = await validateDto({ refreshToken: true });
    expect(errors.some((e) => e.property === 'refreshToken')).toBe(true);
  });
});
