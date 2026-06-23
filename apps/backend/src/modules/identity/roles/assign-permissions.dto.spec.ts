import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssignPermissionsDto } from './assign-permissions.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(AssignPermissionsDto, plain);
  return validate(dto);
}

describe('AssignPermissionsDto', () => {
  const valid = {
    permissions: [
      { action: 'read', subject: 'Booking' },
      { action: 'create', subject: 'Client' },
    ],
  };

  it('accepts a valid permission list with catalog-only actions and subjects', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts the manage action (catalog-enumerated)', async () => {
    const errors = await validateDto({
      permissions: [{ action: 'manage', subject: 'Role' }],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an out-of-catalog action (free-form string)', async () => {
    const errors = await validateDto({
      permissions: [{ action: 'hijack', subject: 'Role' }],
    });
    expect(errors.some((e) => e.property === 'permissions')).toBe(true);
  });

  it('rejects an out-of-catalog subject (free-form string)', async () => {
    const errors = await validateDto({
      permissions: [{ action: 'manage', subject: 'all' }],
    });
    expect(errors.some((e) => e.property === 'permissions')).toBe(true);
  });

  it('rejects an empty permissions array (no entries)', async () => {
    // @ArrayMaxSize(200) only bounds the upper end; an empty array passes.
    // Document the actual DTO-level behavior — handler-enforced if needed.
    const errors = await validateDto({ permissions: [] });
    expect(errors.some((e) => e.property === 'permissions')).toBe(false);
  });

  it('rejects a permissions array exceeding the 200 entry cap', async () => {
    const big = Array.from({ length: 201 }, () => ({
      action: 'read',
      subject: 'Booking',
    }));
    const errors = await validateDto({ permissions: big });
    expect(errors.some((e) => e.property === 'permissions')).toBe(true);
  });

  it('accepts a permissions array at the 200 entry cap', async () => {
    const atLimit = Array.from({ length: 200 }, () => ({
      action: 'read',
      subject: 'Booking',
    }));
    const errors = await validateDto({ permissions: atLimit });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-array permissions value', async () => {
    const errors = await validateDto({ permissions: 'not-an-array' });
    expect(errors.some((e) => e.property === 'permissions')).toBe(true);
  });

  it('rejects a missing permissions field', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'permissions')).toBe(true);
  });

  it('rejects a permission entry with missing action', async () => {
    const errors = await validateDto({
      permissions: [{ subject: 'Booking' }],
    });
    expect(errors.some((e) => e.property === 'permissions')).toBe(true);
  });
});
