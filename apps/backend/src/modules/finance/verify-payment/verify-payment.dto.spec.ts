import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VerifyPaymentDto } from './verify-payment.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(VerifyPaymentDto, plain);
  return validate(dto);
}

describe('VerifyPaymentDto', () => {
  it('accepts action = "approve" with no transferRef', async () => {
    const errors = await validateDto({ action: 'approve' });
    expect(errors).toHaveLength(0);
  });

  it('accepts action = "reject"', async () => {
    const errors = await validateDto({ action: 'reject' });
    expect(errors).toHaveLength(0);
  });

  it('accepts action with an optional transferRef string', async () => {
    const errors = await validateDto({
      action: 'approve',
      transferRef: 'TRF-20260501-001',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an action outside the allowed enum', async () => {
    const errors = await validateDto({ action: 'maybe' });
    expect(errors.some((e) => e.property === 'action')).toBe(true);
  });

  it('rejects a missing action (IsDefined)', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'action')).toBe(true);
  });

  it('rejects a non-string action', async () => {
    const errors = await validateDto({ action: 1 });
    expect(errors.some((e) => e.property === 'action')).toBe(true);
  });

  it('rejects a non-string transferRef', async () => {
    const errors = await validateDto({ action: 'approve', transferRef: { id: 'x' } });
    expect(errors.some((e) => e.property === 'transferRef')).toBe(true);
  });
});
