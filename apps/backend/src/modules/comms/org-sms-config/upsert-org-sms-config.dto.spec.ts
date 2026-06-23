import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  UnifonicCredentialsDto,
  UpsertOrgSmsConfigDto,
} from './upsert-org-sms-config.dto';

async function validateUnifonic(plain: Record<string, unknown>) {
  const dto = plainToInstance(UnifonicCredentialsDto, plain);
  return validate(dto);
}

async function validateUpsert(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpsertOrgSmsConfigDto, plain);
  return validate(dto);
}

const validUnifonic: Record<string, unknown> = {
  appSid: 'APP_SID_123',
  apiKey: 'Bearer-token-abcdef',
};

describe('UnifonicCredentialsDto', () => {
  it('accepts a valid payload', async () => {
    const errors = await validateUnifonic(validUnifonic);
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing appSid', async () => {
    const errors = await validateUnifonic({ apiKey: validUnifonic.apiKey });
    expect(errors.some((e) => e.property === 'appSid')).toBe(true);
  });

  it('rejects an appSid longer than 200 chars', async () => {
    const errors = await validateUnifonic({ ...validUnifonic, appSid: 'a'.repeat(201) });
    expect(errors.some((e) => e.property === 'appSid')).toBe(true);
  });

  it('rejects a non-string apiKey', async () => {
    const errors = await validateUnifonic({ ...validUnifonic, apiKey: 12345 });
    expect(errors.some((e) => e.property === 'apiKey')).toBe(true);
  });

  it('rejects an apiKey longer than 500 chars', async () => {
    const errors = await validateUnifonic({ ...validUnifonic, apiKey: 'a'.repeat(501) });
    expect(errors.some((e) => e.property === 'apiKey')).toBe(true);
  });
});

describe('UpsertOrgSmsConfigDto', () => {
  it('accepts NONE provider without credentials', async () => {
    const errors = await validateUpsert({ provider: 'NONE' });
    expect(errors).toHaveLength(0);
  });

  it('accepts UNIFONIC with nested unifonic credentials', async () => {
    const errors = await validateUpsert({ provider: 'UNIFONIC', unifonic: validUnifonic });
    expect(errors).toHaveLength(0);
  });

  it('accepts a senderId within MaxLength(50)', async () => {
    const errors = await validateUpsert({ provider: 'NONE', senderId: 'SAWA-CLINIC' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a senderId longer than 50 chars', async () => {
    const errors = await validateUpsert({ provider: 'NONE', senderId: 'a'.repeat(51) });
    expect(errors.some((e) => e.property === 'senderId')).toBe(true);
  });

  it('rejects a provider outside the enum', async () => {
    const errors = await validateUpsert({ provider: 'TWILIO' });
    expect(errors.some((e) => e.property === 'provider')).toBe(true);
  });

  it('rejects a missing provider', async () => {
    const errors = await validateUpsert({});
    expect(errors.some((e) => e.property === 'provider')).toBe(true);
  });

  it('rejects unifonic credentials that fail nested validation', async () => {
    const errors = await validateUpsert({
      provider: 'UNIFONIC',
      unifonic: { ...validUnifonic, apiKey: 12345 },
    });
    expect(errors.some((e) => e.property === 'unifonic')).toBe(true);
  });
});
