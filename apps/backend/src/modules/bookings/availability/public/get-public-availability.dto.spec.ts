import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeliveryType } from '@prisma/client';
import { GetPublicAvailabilityDto } from './get-public-availability.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(GetPublicAvailabilityDto, plain);
  return validate(dto);
}

describe('GetPublicAvailabilityDto', () => {
  const valid: Record<string, unknown> = {
    date: '2026-04-20',
  };

  it('accepts a valid payload with just date', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully-populated valid payload', async () => {
    const errors = await validateDto({
      date: '2026-04-20',
      serviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      branchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      durationOptionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      deliveryType: DeliveryType.IN_PERSON,
      bookingType: 'INDIVIDUAL',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-date date', async () => {
    const errors = await validateDto({ date: 'tomorrow' });
    expect(errors.some((e) => e.property === 'date')).toBe(true);
  });

  it('rejects a missing date', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'date')).toBe(true);
  });

  it('rejects a non-UUID serviceId', async () => {
    const errors = await validateDto({ ...valid, serviceId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'serviceId')).toBe(true);
  });

  it('rejects a non-UUID branchId', async () => {
    const errors = await validateDto({ ...valid, branchId: 'bad-id' });
    expect(errors.some((e) => e.property === 'branchId')).toBe(true);
  });

  it('rejects a non-UUID durationOptionId', async () => {
    const errors = await validateDto({ ...valid, durationOptionId: 'bad-id' });
    expect(errors.some((e) => e.property === 'durationOptionId')).toBe(true);
  });

  it('accepts every DeliveryType enum value', async () => {
    for (const value of Object.values(DeliveryType)) {
      const errors = await validateDto({ ...valid, deliveryType: value });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an unknown deliveryType', async () => {
    const errors = await validateDto({ ...valid, deliveryType: 'POSTAL' });
    expect(errors.some((e) => e.property === 'deliveryType')).toBe(true);
  });

  it('accepts a string bookingType', async () => {
    const errors = await validateDto({ ...valid, bookingType: 'INDIVIDUAL' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string bookingType', async () => {
    const errors = await validateDto({ ...valid, bookingType: 12345 });
    expect(errors.some((e) => e.property === 'bookingType')).toBe(true);
  });
});
