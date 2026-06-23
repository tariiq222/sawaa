import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRoleDto } from './create-role.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateRoleDto, plain);
  return validate(dto);
}

describe('CreateRoleDto', () => {
  it('accepts a valid role name', async () => {
    const errors = await validateDto({ name: 'Reception Manager' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a role name at the 2-char lower bound', async () => {
    const errors = await validateDto({ name: 'Ab' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a 1-char role name (below min length)', async () => {
    const errors = await validateDto({ name: 'A' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects an empty role name', async () => {
    const errors = await validateDto({ name: '' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a missing name', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a non-string name', async () => {
    const errors = await validateDto({ name: 42 });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });
});
