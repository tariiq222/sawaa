import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GeneratePresignedUrlDto } from './generate-presigned-url.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(GeneratePresignedUrlDto, plain);
  return validate(dto);
}

describe('GeneratePresignedUrlDto', () => {
  it('accepts an empty payload (expiry is optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts expirySeconds within range', async () => {
    const errors = await validateDto({ expirySeconds: 600 });
    expect(errors).toHaveLength(0);
  });

  it('accepts expirySeconds at the Min(60) boundary', async () => {
    const errors = await validateDto({ expirySeconds: 60 });
    expect(errors.some((e) => e.property === 'expirySeconds')).toBe(false);
  });

  it('accepts expirySeconds at the Max(900) boundary', async () => {
    const errors = await validateDto({ expirySeconds: 900 });
    expect(errors.some((e) => e.property === 'expirySeconds')).toBe(false);
  });

  it('rejects expirySeconds < 60', async () => {
    const errors = await validateDto({ expirySeconds: 59 });
    expect(errors.some((e) => e.property === 'expirySeconds')).toBe(true);
  });

  it('rejects expirySeconds > 900', async () => {
    const errors = await validateDto({ expirySeconds: 901 });
    expect(errors.some((e) => e.property === 'expirySeconds')).toBe(true);
  });

  it('coerces string expirySeconds via Type(() => Number)', async () => {
    const errors = await validateDto({ expirySeconds: '600' });
    expect(errors.some((e) => e.property === 'expirySeconds')).toBe(false);
  });

  it('rejects a non-integer expirySeconds', async () => {
    const errors = await validateDto({ expirySeconds: 600.5 });
    expect(errors.some((e) => e.property === 'expirySeconds')).toBe(true);
  });
});
