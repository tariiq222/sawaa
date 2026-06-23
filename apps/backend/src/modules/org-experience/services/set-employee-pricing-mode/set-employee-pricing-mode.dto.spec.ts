import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SetEmployeePricingModeDto } from './set-employee-pricing-mode.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(SetEmployeePricingModeDto, plain);
  return validate(dto);
}

describe('SetEmployeePricingModeDto', () => {
  it('accepts useCustomPricing = true', async () => {
    const errors = await validateDto({ useCustomPricing: true });
    expect(errors).toHaveLength(0);
  });

  it('accepts useCustomPricing = false', async () => {
    const errors = await validateDto({ useCustomPricing: false });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing useCustomPricing', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'useCustomPricing')).toBe(true);
  });

  it('rejects a non-boolean useCustomPricing (string)', async () => {
    const errors = await validateDto({ useCustomPricing: 'true' });
    expect(errors.some((e) => e.property === 'useCustomPricing')).toBe(true);
  });

  it('rejects a non-boolean useCustomPricing (number)', async () => {
    const errors = await validateDto({ useCustomPricing: 1 });
    expect(errors.some((e) => e.property === 'useCustomPricing')).toBe(true);
  });
});
