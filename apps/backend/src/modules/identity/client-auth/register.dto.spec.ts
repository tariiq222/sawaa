import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(RegisterDto, plain);
  return validate(dto);
}

describe('RegisterDto', () => {
  const valid: Record<string, unknown> = {
    name: 'أحمد محمد',
    password: 'SecurePass123',
  };

  it('accepts a valid payload with optional name', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid payload without name (optional)', async () => {
    const errors = await validateDto({ password: 'SecurePass123' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a name longer than 200 chars', async () => {
    const tooLong = 'أ'.repeat(201);
    const errors = await validateDto({ ...valid, name: tooLong });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a password shorter than 8 chars', async () => {
    const errors = await validateDto({ ...valid, password: 'short' });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a password with no uppercase letter', async () => {
    const errors = await validateDto({ ...valid, password: 'alllower123' });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a password with no digit', async () => {
    const errors = await validateDto({ ...valid, password: 'NoDigitsHere' });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a password longer than 200 chars', async () => {
    const tooLong = 'Aa1' + 'x'.repeat(198); // 201 chars
    const errors = await validateDto({ ...valid, password: tooLong });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('accepts a password at the 200-char upper bound', async () => {
    const atLimit = 'Aa1' + 'x'.repeat(197); // 200 chars
    const errors = await validateDto({ ...valid, password: atLimit });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing password (required field)', async () => {
    const errors = await validateDto({ name: 'NoPassword' });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a non-string password', async () => {
    const errors = await validateDto({ ...valid, password: 12345 });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
