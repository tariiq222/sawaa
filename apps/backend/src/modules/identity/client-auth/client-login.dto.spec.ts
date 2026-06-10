import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClientLoginDto } from './client-login.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(ClientLoginDto, payload);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('ClientLoginDto', () => {
  it('should be defined', () => {
    const dto = new ClientLoginDto();
    expect(dto).toBeDefined();
  });

  it('accepts email + password (no phone)', async () => {
    const { errors } = await validateDto({
      email: 'client@example.com',
      password: 'SecurePass123',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts phone + password (no email)', async () => {
    const { errors } = await validateDto({
      phone: '+966501234567',
      password: 'SecurePass123',
    });
    expect(errors).toHaveLength(0);
  });

  it('normalizes a local-format Saudi phone to E.164', async () => {
    const { dto, errors } = await validateDto({
      phone: '0501234567',
      password: 'SecurePass123',
    });
    expect(errors).toHaveLength(0);
    expect(dto.phone).toBe('+966501234567');
  });

  it('rejects a non-Saudi phone number', async () => {
    const { errors } = await validateDto({
      phone: '+12025550123',
      password: 'SecurePass123',
    });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('rejects an invalid email', async () => {
    const { errors } = await validateDto({
      email: 'not-an-email',
      password: 'SecurePass123',
    });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a too-short password', async () => {
    const { errors } = await validateDto({
      email: 'client@example.com',
      password: 'short',
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('allows both identifier fields to be absent at DTO level (exactly-one rule is handler-enforced)', async () => {
    const { errors } = await validateDto({ password: 'SecurePass123' });
    expect(errors).toHaveLength(0);
  });
});
