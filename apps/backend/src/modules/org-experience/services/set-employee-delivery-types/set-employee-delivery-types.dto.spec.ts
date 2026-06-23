import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SetEmployeeDeliveryTypesDto } from './set-employee-delivery-types.dto';
import { DeliveryType } from '@prisma/client';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(SetEmployeeDeliveryTypesDto, plain);
  return validate(dto);
}

describe('SetEmployeeDeliveryTypesDto', () => {
  it('accepts a valid payload (empty array)', async () => {
    const errors = await validateDto({ disabledDeliveryTypes: [] });
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid payload (one disabled type)', async () => {
    const errors = await validateDto({ disabledDeliveryTypes: ['ONLINE'] });
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload (both delivery types disabled)', async () => {
    const errors = await validateDto({
      disabledDeliveryTypes: [DeliveryType.IN_PERSON, DeliveryType.ONLINE],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing disabledDeliveryTypes', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'disabledDeliveryTypes')).toBe(true);
  });

  it('rejects a non-array disabledDeliveryTypes', async () => {
    const errors = await validateDto({ disabledDeliveryTypes: 'ONLINE' });
    expect(errors.some((e) => e.property === 'disabledDeliveryTypes')).toBe(true);
  });

  it('rejects an out-of-enum value', async () => {
    const errors = await validateDto({ disabledDeliveryTypes: ['TELEPATHY'] });
    expect(errors.some((e) => e.property === 'disabledDeliveryTypes')).toBe(true);
  });
});
