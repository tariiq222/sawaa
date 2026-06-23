import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertMoyasarConfigDto } from './upsert-moyasar-config.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpsertMoyasarConfigDto, plain);
  return validate(dto);
}

describe('UpsertMoyasarConfigDto', () => {
  const validPublishable = 'pk_test_abcdefghijklmnopqrstuvwxyz1234';
  const validSecret = 'sk_test_abcdefghijklmnopqrstuvwxyz1234';

  it('accepts a valid publishable key only', async () => {
    const errors = await validateDto({ publishableKey: validPublishable });
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully-populated valid payload', async () => {
    const errors = await validateDto({
      publishableKey: validPublishable,
      secretKey: validSecret,
      webhookSecret: 'webhook-secret-12345',
      isLive: false,
    });
    expect(errors).toHaveLength(0);
  });

  describe('publishableKey (Matches /^pk_(test|live)_[A-Za-z0-9]{20,}$/)', () => {
    it('accepts pk_live_…', async () => {
      const errors = await validateDto({ publishableKey: 'pk_live_abcdefghijklmnopqrstuvwxyz1234' });
      expect(errors).toHaveLength(0);
    });
    it('rejects an sk_ prefix (wrong key type)', async () => {
      const errors = await validateDto({ publishableKey: validSecret });
      expect(errors.some((e) => e.property === 'publishableKey')).toBe(true);
    });
    it('rejects a key shorter than the 20-char tail', async () => {
      const errors = await validateDto({ publishableKey: 'pk_test_short' });
      expect(errors.some((e) => e.property === 'publishableKey')).toBe(true);
    });
    it('rejects a key with illegal characters', async () => {
      const errors = await validateDto({ publishableKey: 'pk_test_!!@@##$$%%^^&&**((' });
      expect(errors.some((e) => e.property === 'publishableKey')).toBe(true);
    });
    it('rejects a missing publishableKey', async () => {
      const errors = await validateDto({});
      expect(errors.some((e) => e.property === 'publishableKey')).toBe(true);
    });
  });

  describe('secretKey (optional, same shape)', () => {
    it('accepts sk_test_…', async () => {
      const errors = await validateDto({ publishableKey: validPublishable, secretKey: validSecret });
      expect(errors).toHaveLength(0);
    });
    it('accepts sk_live_…', async () => {
      const errors = await validateDto({
        publishableKey: validPublishable,
        secretKey: 'sk_live_abcdefghijklmnopqrstuvwxyz1234',
      });
      expect(errors).toHaveLength(0);
    });
    it('rejects a pk_ prefix (wrong key type)', async () => {
      const errors = await validateDto({ publishableKey: validPublishable, secretKey: validPublishable });
      expect(errors.some((e) => e.property === 'secretKey')).toBe(true);
    });
  });

  describe('webhookSecret (optional, MinLength(8) + MaxLength(256))', () => {
    it('accepts an 8-char secret (lower bound)', async () => {
      const errors = await validateDto({ publishableKey: validPublishable, webhookSecret: '12345678' });
      expect(errors).toHaveLength(0);
    });
    it('accepts a 256-char secret (upper bound)', async () => {
      const errors = await validateDto({
        publishableKey: validPublishable,
        webhookSecret: 'x'.repeat(256),
      });
      expect(errors).toHaveLength(0);
    });
    it('rejects a 7-char secret', async () => {
      const errors = await validateDto({ publishableKey: validPublishable, webhookSecret: '1234567' });
      expect(errors.some((e) => e.property === 'webhookSecret')).toBe(true);
    });
    it('rejects a 257-char secret', async () => {
      const errors = await validateDto({
        publishableKey: validPublishable,
        webhookSecret: 'x'.repeat(257),
      });
      expect(errors.some((e) => e.property === 'webhookSecret')).toBe(true);
    });
  });

  describe('isLive (optional IsBoolean)', () => {
    it('accepts true and false', async () => {
      expect((await validateDto({ publishableKey: validPublishable, isLive: true }))).toHaveLength(0);
      expect((await validateDto({ publishableKey: validPublishable, isLive: false }))).toHaveLength(0);
    });
    it('rejects a non-boolean', async () => {
      const errors = await validateDto({ publishableKey: validPublishable, isLive: 'yes' });
      expect(errors.some((e) => e.property === 'isLive')).toBe(true);
    });
  });
});
