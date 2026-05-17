import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBundleDto } from './create-bundle.dto';
import { DiscountType } from '@prisma/client';

async function validateDto(plain: Record<string, unknown>) {
  const instance = plainToInstance(CreateBundleDto, plain);
  return validate(instance);
}

const validPayload: Record<string, unknown> = {
  nameAr: 'باقة العناية',
  discountType: DiscountType.PERCENTAGE,
  discountValue: 10,
  serviceIds: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'],
};

describe('CreateBundleDto', () => {
  it('passes validation for a valid payload', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('fails when serviceIds has fewer than 2 items', async () => {
    const errors = await validateDto({
      ...validPayload,
      serviceIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('serviceIds');
  });

  it('fails when serviceIds is empty', async () => {
    const errors = await validateDto({ ...validPayload, serviceIds: [] });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails when discountValue is negative', async () => {
    const errors = await validateDto({ ...validPayload, discountValue: -5 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('discountValue');
  });

  it('fails when nameAr is missing', async () => {
    const { nameAr: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails when discountType is invalid', async () => {
    const errors = await validateDto({ ...validPayload, discountType: 'INVALID' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails when serviceIds contains invalid UUIDs', async () => {
    const errors = await validateDto({
      ...validPayload,
      serviceIds: ['not-a-uuid', 'also-not-uuid'],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
