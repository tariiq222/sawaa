import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MoyasarWebhookDto, MoyasarWebhookMetadataDto, MoyasarWebhookDataDto } from './moyasar-webhook.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(MoyasarWebhookDto, plain);
  return validate(dto);
}

describe('MoyasarWebhookMetadataDto', () => {
  it('accepts an empty payload (invoiceId is optional)', async () => {
    const dto = plainToInstance(MoyasarWebhookMetadataDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts an invoiceId string', async () => {
    const dto = plainToInstance(MoyasarWebhookMetadataDto, { invoiceId: 'inv-1' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string invoiceId', async () => {
    const dto = plainToInstance(MoyasarWebhookMetadataDto, { invoiceId: 12345 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'invoiceId')).toBe(true);
  });
});

describe('MoyasarWebhookDataDto', () => {
  it('accepts an empty payload (every field optional)', async () => {
    const dto = plainToInstance(MoyasarWebhookDataDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts every allowed status value', async () => {
    for (const status of ['paid', 'failed', 'refunded', 'authorized', 'captured', 'voided'] as const) {
      const dto = plainToInstance(MoyasarWebhookDataDto, { status });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an unknown status', async () => {
    const dto = plainToInstance(MoyasarWebhookDataDto, { status: 'pending' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  describe('amount (IsInt + Min(1))', () => {
    it('coerces a string amount to an integer', async () => {
      const dto = plainToInstance(MoyasarWebhookDataDto, { amount: '13800' });
      expect(dto.amount).toBe(13800);
      expect(await validate(dto)).toHaveLength(0);
    });
    it('rejects amount = 0', async () => {
      const dto = plainToInstance(MoyasarWebhookDataDto, { amount: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });
  });

  it('accepts only SAR as the currency value', async () => {
    const ok = plainToInstance(MoyasarWebhookDataDto, { currency: 'SAR' });
    expect(await validate(ok)).toHaveLength(0);
    const bad = plainToInstance(MoyasarWebhookDataDto, { currency: 'KWD' });
    const errors = await validate(bad);
    expect(errors.some((e) => e.property === 'currency')).toBe(true);
  });

  it('validates a nested metadata object', async () => {
    const dto = plainToInstance(MoyasarWebhookDataDto, { metadata: { invoiceId: 'inv-1' } });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('MoyasarWebhookDto', () => {
  // The DTO is intentionally permissive: it accepts BOTH the nested and flat
  // shapes (every field optional). The handler performs the real "is this
  // resolvable?" semantic check after normalization.

  it('accepts an empty payload (everything optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('validates the FLAT shape (payment fields at the root)', async () => {
    const dto = plainToInstance(MoyasarWebhookDto, {
      id: 'pay_abc123',
      status: 'paid',
      amount: 13800,
      currency: 'SAR',
      metadata: { invoiceId: '00000000-0000-0000-0000-000000000000' },
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('validates the NESTED shape (event envelope + data payment object)', async () => {
    const dto = plainToInstance(MoyasarWebhookDto, {
      id: 'evt_abc123',
      type: 'payment_paid',
      created_at: '2024-01-15T10:30:00Z',
      secret_token: 'the-shared-secret',
      data: {
        id: 'pay_abc123',
        status: 'paid',
        amount: 13800,
        currency: 'SAR',
        metadata: { invoiceId: '00000000-0000-0000-0000-000000000000' },
        message: 'Approved',
      },
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a genuinely-malformed payload (wrong field types)', async () => {
    const dto = plainToInstance(MoyasarWebhookDto, {
      id: 12345,
      type: { not: 'a string' },
      data: {
        amount: 0, // violates @Min(1)
        currency: 'KWD', // violates @IsIn(['SAR'])
      },
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a flat payload whose amount is zero', async () => {
    const dto = plainToInstance(MoyasarWebhookDto, {
      id: 'pay-zero',
      status: 'paid',
      amount: 0,
      currency: 'SAR',
      metadata: { invoiceId: 'inv-1' },
    });
    const errors = await validate(dto);
    const amountErrors = errors.filter((e) => e.property === 'amount');
    expect(amountErrors.length).toBeGreaterThan(0);
  });

  it('rejects a non-string type (nested shape)', async () => {
    const dto = plainToInstance(MoyasarWebhookDto, { type: 42 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects an unknown status at the root (flat shape)', async () => {
    const dto = plainToInstance(MoyasarWebhookDto, { status: 'pending' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });
});
