import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertPlatformSettingDto } from './upsert-platform-setting.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpsertPlatformSettingDto, plain);
  return validate(dto);
}

describe('UpsertPlatformSettingDto', () => {
  it('accepts a valid key + value (no secret)', async () => {
    const errors = await validateDto({ key: 'feature.beta.enabled', value: 'true' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid key + value + secret', async () => {
    const errors = await validateDto({
      key: 'oauth.client.secret',
      value: 'placeholder',
      secret: 'sk_live_abcdefghijklmnopqrstuvwxyz',
    });
    expect(errors).toHaveLength(0);
  });

  describe('key (IsString + IsNotEmpty)', () => {
    it('rejects a missing key', async () => {
      const errors = await validateDto({ value: 'true' });
      expect(errors.some((e) => e.property === 'key')).toBe(true);
    });
    it('rejects an empty key (IsNotEmpty)', async () => {
      const errors = await validateDto({ key: '', value: 'true' });
      expect(errors.some((e) => e.property === 'key')).toBe(true);
    });
    it('rejects a non-string key', async () => {
      const errors = await validateDto({ key: 42, value: 'true' });
      expect(errors.some((e) => e.property === 'key')).toBe(true);
    });
  });

  describe('value (IsString + IsNotEmpty)', () => {
    it('rejects a missing value', async () => {
      const errors = await validateDto({ key: 'feature.beta.enabled' });
      expect(errors.some((e) => e.property === 'value')).toBe(true);
    });
    it('rejects an empty value (IsNotEmpty)', async () => {
      const errors = await validateDto({ key: 'feature.beta.enabled', value: '' });
      expect(errors.some((e) => e.property === 'value')).toBe(true);
    });
    it('rejects a non-string value', async () => {
      const errors = await validateDto({ key: 'feature.beta.enabled', value: { v: 'x' } });
      expect(errors.some((e) => e.property === 'value')).toBe(true);
    });
  });

  describe('secret (optional IsString)', () => {
    it('rejects a non-string secret', async () => {
      const errors = await validateDto({
        key: 'oauth.client.secret',
        value: 'placeholder',
        secret: { s: 'x' },
      });
      expect(errors.some((e) => e.property === 'secret')).toBe(true);
    });
  });
});
