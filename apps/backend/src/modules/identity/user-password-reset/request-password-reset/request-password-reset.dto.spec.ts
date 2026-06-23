import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestPasswordResetDto } from './request-password-reset.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(RequestPasswordResetDto, plain);
  return validate(dto);
}

describe('RequestPasswordResetDto', () => {
  it('accepts a valid email', async () => {
    const errors = await validateDto({ email: 'admin@sawa.example' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const errors = await validateDto({ email: 'not-an-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects an empty email', async () => {
    const errors = await validateDto({ email: '' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a missing email', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a non-string email', async () => {
    const errors = await validateDto({ email: 12345 });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a whitespace-only email', async () => {
    const errors = await validateDto({ email: '   ' });
    // @IsEmail rejects whitespace-only as no local-part matches.
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });
});
