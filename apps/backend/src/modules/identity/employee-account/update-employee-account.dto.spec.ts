import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateEmployeeAccountDto } from './update-employee-account.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateEmployeeAccountDto, plain);
  return validate(dto);
}

describe('UpdateEmployeeAccountDto', () => {
  it('accepts an empty payload (all fields are optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid role update', async () => {
    const errors = await validateDto({ role: 'ADMIN' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid isActive boolean update', async () => {
    const errors = await validateDto({ isActive: true });
    expect(errors).toHaveLength(0);
  });

  it('accepts both fields updated together', async () => {
    const errors = await validateDto({ role: 'ACCOUNTANT', isActive: false });
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown role enum value', async () => {
    const errors = await validateDto({ role: 'NOT_A_ROLE' });
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });

  it('rejects a non-boolean isActive (string)', async () => {
    const errors = await validateDto({ isActive: 'true' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a non-boolean isActive (number)', async () => {
    const errors = await validateDto({ isActive: 1 });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });
});
