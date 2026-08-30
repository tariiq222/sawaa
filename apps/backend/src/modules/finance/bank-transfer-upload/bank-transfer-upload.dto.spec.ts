import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BankTransferUploadDto } from './bank-transfer-upload.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(BankTransferUploadDto, plain, { enableImplicitConversion: true });
  return validate(dto);
}

describe('BankTransferUploadDto', () => {
  const valid: Record<string, unknown> = {
    invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    amount: 100.0,
  };

  it('accepts a valid payload', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('coerces a numeric string amount to a number', async () => {
    const dto = plainToInstance(
      BankTransferUploadDto,
      { invoiceId: valid.invoiceId, amount: '250' },
      { enableImplicitConversion: true },
    );
    expect(dto.amount).toBe(250);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects fractional halala amounts', async () => {
    const errors = await validateDto({ ...valid, amount: 250.75 });
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('rejects a non-UUID invoiceId', async () => {
    const errors = await validateDto({ ...valid, invoiceId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'invoiceId')).toBe(true);
  });

  it('rejects a missing invoiceId', async () => {
    const errors = await validateDto({ amount: valid.amount });
    expect(errors.some((e) => e.property === 'invoiceId')).toBe(true);
  });

  it('rejects a negative amount (Min(0))', async () => {
    const errors = await validateDto({ ...valid, amount: -0.01 });
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('rejects amount = 0', async () => {
    const errors = await validateDto({ ...valid, amount: 0 });
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('rejects a non-number amount (object)', async () => {
    const errors = await validateDto({ ...valid, amount: { v: 100 } });
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('rejects a missing amount', async () => {
    const errors = await validateDto({ invoiceId: valid.invoiceId });
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });
});
