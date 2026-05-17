import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MoyasarWebhookDto, MoyasarWebhookMetadataDto } from './moyasar-webhook.dto';

describe('MoyasarWebhookMetadataDto', () => {
  it('should be defined', () => {
    const dto = new MoyasarWebhookMetadataDto();
    expect(dto).toBeDefined();
  });
});

describe('MoyasarWebhookDto', () => {
  // The DTO is intentionally permissive: it accepts BOTH the nested and flat
  // shapes (every field optional). The handler performs the real "is this
  // resolvable?" semantic check after normalization.

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
});
