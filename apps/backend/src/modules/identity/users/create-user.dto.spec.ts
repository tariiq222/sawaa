import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateUserDto, plain);
  return validate(dto);
}

describe('CreateUserDto', () => {
  const valid: Record<string, unknown> = {
    email: 'staff@sawa.example',
    password: 'P@ssw0rd123',
    name: 'Sara Al-Harbi',
    role: 'RECEPTIONIST',
  };

  it('accepts a fully valid payload (required fields only)', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a payload with all optional fields populated', async () => {
    const errors = await validateDto({
      ...valid,
      phone: '0501234567', // normalized to +966501234567
      gender: 'FEMALE',
      customRoleId: '00000000-0000-0000-0000-000000000000',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const errors = await validateDto({ ...valid, email: 'not-an-email' });
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

  it('rejects a non-string name (numeric)', async () => {
    const errors = await validateDto({ ...valid, name: 42 });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a name longer than 200 chars', async () => {
    const tooLong = 'A'.repeat(201);
    const errors = await validateDto({ ...valid, name: tooLong });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects an unknown role (not in UserRole enum)', async () => {
    const errors = await validateDto({ ...valid, role: 'GOD_MODE' });
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });

  it('rejects an invalid UUID for customRoleId', async () => {
    const errors = await validateDto({ ...valid, customRoleId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'customRoleId')).toBe(true);
  });

  it('rejects an invalid gender enum value', async () => {
    const errors = await validateDto({ ...valid, gender: 'OTHER' });
    expect(errors.some((e) => e.property === 'gender')).toBe(true);
  });

  it('rejects a missing email', async () => {
    const { email, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a missing required field set (email, password, name, role)', async () => {
    const errors = await validateDto({});
    const props = errors.map((e) => e.property);
    expect(props).toEqual(expect.arrayContaining(['email', 'password', 'name', 'role']));
  });
});
