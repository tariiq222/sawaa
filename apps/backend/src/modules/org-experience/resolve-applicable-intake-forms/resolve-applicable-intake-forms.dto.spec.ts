import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResolveApplicableIntakeFormsDto } from './resolve-applicable-intake-forms.dto';
import { IntakeFormType } from '@prisma/client';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ResolveApplicableIntakeFormsDto, plain);
  return validate(dto);
}

describe('ResolveApplicableIntakeFormsDto', () => {
  it('accepts an empty payload (all filters optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a payload with one filter', async () => {
    const errors = await validateDto({
      serviceId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateDto({
      serviceId: '550e8400-e29b-41d4-a716-446655440000',
      employeeId: '550e8400-e29b-41d4-a716-446655440001',
      branchId: '550e8400-e29b-41d4-a716-446655440002',
      type: IntakeFormType.PRE_BOOKING,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID serviceId', async () => {
    const errors = await validateDto({ serviceId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'serviceId')).toBe(true);
  });

  it('rejects a non-UUID employeeId', async () => {
    const errors = await validateDto({ employeeId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'employeeId')).toBe(true);
  });

  it('rejects a non-UUID branchId', async () => {
    const errors = await validateDto({ branchId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'branchId')).toBe(true);
  });

  it('rejects an out-of-enum type', async () => {
    const errors = await validateDto({ type: 'UNEXPECTED' });
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('accepts each valid type', async () => {
    for (const type of [
      IntakeFormType.PRE_BOOKING,
      IntakeFormType.PRE_SESSION,
      IntakeFormType.POST_SESSION,
      IntakeFormType.REGISTRATION,
    ]) {
      const errors = await validateDto({ type });
      expect(errors).toHaveLength(0);
    }
  });
});
