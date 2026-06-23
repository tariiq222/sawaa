import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertIntegrationDto } from './upsert-integration.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpsertIntegrationDto, plain);
  return validate(dto);
}

describe('UpsertIntegrationDto', () => {
  const valid: Record<string, unknown> = {
    provider: 'MOYASAR',
    config: { apiKey: 'sk_test_...', webhookSecret: 'wh_...' },
  };

  it('accepts a valid payload (provider + config)', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts an optional isActive boolean', async () => {
    expect((await validateDto({ ...valid, isActive: true }))).toHaveLength(0);
    expect((await validateDto({ ...valid, isActive: false }))).toHaveLength(0);
  });

  it('rejects a missing provider', async () => {
    const errors = await validateDto({ config: valid.config });
    expect(errors.some((e) => e.property === 'provider')).toBe(true);
  });

  it('rejects a non-string provider', async () => {
    const errors = await validateDto({ ...valid, provider: 42 });
    expect(errors.some((e) => e.property === 'provider')).toBe(true);
  });

  it('rejects a missing config', async () => {
    const errors = await validateDto({ provider: valid.provider });
    expect(errors.some((e) => e.property === 'config')).toBe(true);
  });

  it('rejects a non-object config (string)', async () => {
    const errors = await validateDto({ ...valid, config: 'not-an-object' });
    expect(errors.some((e) => e.property === 'config')).toBe(true);
  });

  it('rejects a non-object config (array)', async () => {
    const errors = await validateDto({ ...valid, config: ['x', 'y'] });
    expect(errors.some((e) => e.property === 'config')).toBe(true);
  });

  it('accepts an empty config object', async () => {
    const errors = await validateDto({ provider: 'MOYASAR', config: {} });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateDto({ ...valid, isActive: { v: true } });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });
});
