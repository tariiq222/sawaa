import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(LoginDto, plain);
  return validate(dto);
}

describe('LoginDto', () => {
  const valid: Record<string, unknown> = {
    email: 'admin@sawa.example',
    password: 'SecurePass123',
  };

  it('accepts a valid payload', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts rememberMe = true as a boolean', async () => {
    const errors = await validateDto({ ...valid, rememberMe: true });
    expect(errors).toHaveLength(0);
  });

  it('accepts rememberMe omitted (optional)', async () => {
    const errors = await validateDto(valid);
    expect(errors.some((e) => e.property === 'rememberMe')).toBe(false);
  });

  it('rejects a non-email value', async () => {
    const errors = await validateDto({ ...valid, email: 'not-an-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects an empty email', async () => {
    const errors = await validateDto({ ...valid, email: '' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a password shorter than 8 chars', async () => {
    const errors = await validateDto({ ...valid, password: 'short' });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a password longer than 200 chars (DoS guard)', async () => {
    const tooLong = 'Aa1' + 'x'.repeat(198); // 201 chars
    const errors = await validateDto({ ...valid, password: tooLong });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('accepts a password at the 200-char upper bound', async () => {
    const atLimit = 'Aa1' + 'x'.repeat(197); // 200 chars
    const errors = await validateDto({ ...valid, password: atLimit });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-boolean rememberMe (string "true" is not boolean)', async () => {
    const errors = await validateDto({ ...valid, rememberMe: 'true' });
    expect(errors.some((e) => e.property === 'rememberMe')).toBe(true);
  });

  it('rejects a missing email', async () => {
    const errors = await validateDto({ password: valid.password });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });
});
