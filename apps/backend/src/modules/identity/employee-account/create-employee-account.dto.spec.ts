import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEmployeeAccountDto } from './create-employee-account.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateEmployeeAccountDto, plain);
  return validate(dto);
}

describe('CreateEmployeeAccountDto', () => {
  it('accepts a valid role with a password', async () => {
    const errors = await validateDto({
      role: 'RECEPTIONIST',
      password: 'P@ssw0rd123',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid role without a password (optional for existing-user matches)', async () => {
    const errors = await validateDto({ role: 'ADMIN' });
    expect(errors).toHaveLength(0);
  });

  it('accepts every enum value of UserRole', async () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'ACCOUNTANT', 'EMPLOYEE', 'CLIENT']) {
      const errors = await validateDto({ role });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an unknown role', async () => {
    const errors = await validateDto({ role: 'GOD_MODE' });
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });

  it('rejects a missing role', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });

  it('rejects a non-string role', async () => {
    const errors = await validateDto({ role: 12345 });
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });

  it('rejects a password shorter than 8 chars when provided', async () => {
    const errors = await validateDto({ role: 'ADMIN', password: 'short' });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('rejects a non-string password when provided', async () => {
    const errors = await validateDto({ role: 'ADMIN', password: 12345 });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('accepts the 8-char lower bound for password', async () => {
    const errors = await validateDto({ role: 'ADMIN', password: 'Aa1bcdef' });
    expect(errors).toHaveLength(0);
  });
});
