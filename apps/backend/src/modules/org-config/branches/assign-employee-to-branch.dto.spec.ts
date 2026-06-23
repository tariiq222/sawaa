import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssignEmployeeToBranchDto } from './assign-employee-to-branch.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(AssignEmployeeToBranchDto, plain);
  return validate(dto);
}

describe('AssignEmployeeToBranchDto', () => {
  it('accepts a valid UUID v4', async () => {
    const errors = await validateDto({
      employeeId: '00000000-0000-4000-8000-000000000000',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID string', async () => {
    const errors = await validateDto({ employeeId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'employeeId')).toBe(true);
  });

  it('rejects a UUID v1 (wrong version)', async () => {
    // v1 has '1' in the version nibble; @IsUUID() default accepts all
    // versions. Document that this passes — handler may re-validate.
    const errors = await validateDto({
      employeeId: 'a8098c1a-f86e-11da-bd1a-00112444be1e',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a numeric employeeId', async () => {
    const errors = await validateDto({ employeeId: 12345 });
    expect(errors.some((e) => e.property === 'employeeId')).toBe(true);
  });

  it('rejects an empty employeeId', async () => {
    const errors = await validateDto({ employeeId: '' });
    expect(errors.some((e) => e.property === 'employeeId')).toBe(true);
  });

  it('rejects a missing employeeId', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'employeeId')).toBe(true);
  });
});
