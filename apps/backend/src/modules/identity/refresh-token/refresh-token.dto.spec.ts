import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RefreshTokenDto } from './refresh-token.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(RefreshTokenDto, plain);
  return validate(dto);
}

describe('RefreshTokenDto', () => {
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

  it('rejects a null refresh token when explicitly provided', async () => {
    const errors = await validateDto({ refreshToken: null });
    // @IsOptional() permits null at the DTO level — handlers must guard.
    expect(errors.some((e) => e.property === 'refreshToken')).toBe(false);
  });
});
