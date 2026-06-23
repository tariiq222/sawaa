import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEmployeeBookingDto } from './create-employee-booking.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateEmployeeBookingDto, plain);
  return validate(dto);
}

describe('CreateEmployeeBookingDto', () => {
  const valid: Record<string, unknown> = {
    branchId: '11111111-1111-4111-8111-111111111111',
    clientId: '22222222-2222-4222-8222-222222222222',
    serviceId: '33333333-3333-4333-8333-333333333333',
    scheduledAt: '2026-05-01T09:00:00.000Z',
  };

  it('accepts a valid payload with the four required fields', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID branchId', async () => {
    const errors = await validateDto({ ...valid, branchId: 'bad' });
    expect(errors.some((e) => e.property === 'branchId')).toBe(true);
  });

  it('rejects a non-UUID clientId', async () => {
    const errors = await validateDto({ ...valid, clientId: 'bad' });
    expect(errors.some((e) => e.property === 'clientId')).toBe(true);
  });

  it('rejects a non-UUID serviceId', async () => {
    const errors = await validateDto({ ...valid, serviceId: 'bad' });
    expect(errors.some((e) => e.property === 'serviceId')).toBe(true);
  });

  it('rejects a non-date scheduledAt', async () => {
    const errors = await validateDto({ ...valid, scheduledAt: 'tomorrow' });
    expect(errors.some((e) => e.property === 'scheduledAt')).toBe(true);
  });

  it('rejects a missing scheduledAt', async () => {
    const errors = await validateDto({
      branchId: valid.branchId,
      clientId: valid.clientId,
      serviceId: valid.serviceId,
    });
    expect(errors.some((e) => e.property === 'scheduledAt')).toBe(true);
  });

  it('accepts an optional UUID durationOptionId', async () => {
    const errors = await validateDto({
      ...valid,
      durationOptionId: '44444444-4444-4444-8444-444444444444',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID durationOptionId', async () => {
    const errors = await validateDto({ ...valid, durationOptionId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'durationOptionId')).toBe(true);
  });

  it('accepts the snake_case bookingType the dashboard sends and uppercases it', async () => {
    const dto = plainToInstance(
      CreateEmployeeBookingDto,
      { ...valid, bookingType: 'walk_in' },
      { enableImplicitConversion: true },
    );
    expect(dto.bookingType).toBe('WALK_IN');
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('transforms the in_person bookingType alias to INDIVIDUAL', async () => {
    const dto = plainToInstance(
      CreateEmployeeBookingDto,
      { ...valid, bookingType: 'in_person' },
      { enableImplicitConversion: true },
    );
    expect(dto.bookingType).toBe('INDIVIDUAL');
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('transforms the snake_case deliveryType and validates', async () => {
    const dto = plainToInstance(
      CreateEmployeeBookingDto,
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

  it('accepts an optional notes string', async () => {
    const errors = await validateDto({ ...valid, notes: 'Walk-in client' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string notes (object — enableImplicitConversion cannot coerce)', async () => {
    const errors = await validateDto({ ...valid, notes: { x: 1 } });
    expect(errors.some((e) => e.property === 'notes')).toBe(true);
  });
});
