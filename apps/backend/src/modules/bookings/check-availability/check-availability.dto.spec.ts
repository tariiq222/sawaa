import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CheckAvailabilityDto } from './check-availability.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CheckAvailabilityDto, plain, { enableImplicitConversion: true });
  return validate(dto);
}

describe('CheckAvailabilityDto', () => {
  const valid: Record<string, unknown> = {
    employeeId: '11111111-1111-4111-8111-111111111111',
    branchId: '22222222-2222-4222-8222-222222222222',
    date: '2026-05-01T00:00:00.000Z',
  };

  it('accepts a valid payload with the three required fields', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID employeeId', async () => {
    const errors = await validateDto({ ...valid, employeeId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'employeeId')).toBe(true);
  });

  it('rejects a non-UUID branchId', async () => {
    const errors = await validateDto({ ...valid, branchId: 'bad-id' });
    expect(errors.some((e) => e.property === 'branchId')).toBe(true);
  });

  it('rejects a non-date date', async () => {
    const errors = await validateDto({ ...valid, date: 'not-a-date' });
    expect(errors.some((e) => e.property === 'date')).toBe(true);
  });

  it('rejects a missing date', async () => {
    const errors = await validateDto({
      employeeId: valid.employeeId,
      branchId: valid.branchId,
    });
    expect(errors.some((e) => e.property === 'date')).toBe(true);
  });

  it('coerces a string durationMins to a number and accepts it', async () => {
    const dto = plainToInstance(CheckAvailabilityDto, { ...valid, durationMins: '60' }, {
      enableImplicitConversion: true,
    });
    expect(dto.durationMins).toBe(60);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects durationMins = 0 (Min(1))', async () => {
    const errors = await validateDto({ ...valid, durationMins: 0 });
    expect(errors.some((e) => e.property === 'durationMins')).toBe(true);
  });

  it('rejects a negative durationMins', async () => {
    const errors = await validateDto({ ...valid, durationMins: -15 });
    expect(errors.some((e) => e.property === 'durationMins')).toBe(true);
  });

  it('rejects a non-integer durationMins', async () => {
    const errors = await validateDto({ ...valid, durationMins: 60.5 });
    expect(errors.some((e) => e.property === 'durationMins')).toBe(true);
  });

  it('accepts optional serviceId and durationOptionId when both are UUIDs', async () => {
    const errors = await validateDto({
      ...valid,
      serviceId: '33333333-3333-4333-8333-333333333333',
      durationOptionId: '44444444-4444-4444-8444-444444444444',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID serviceId', async () => {
    const errors = await validateDto({ ...valid, serviceId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'serviceId')).toBe(true);
  });

  it('transforms snake_case deliveryType to the DB enum and validates', async () => {
    const dto = plainToInstance(
      CheckAvailabilityDto,
      { ...valid, deliveryType: 'online' },
      { enableImplicitConversion: true },
    );
    expect(dto.deliveryType).toBe('ONLINE');
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a genuinely invalid deliveryType', async () => {
    const errors = await validateDto({ ...valid, deliveryType: 'teleport' });
    expect(errors.some((e) => e.property === 'deliveryType')).toBe(true);
  });
});
