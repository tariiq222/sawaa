import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TestSmsConfigDto } from './test-sms-config.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(TestSmsConfigDto, plain);
  return validate(dto);
}

describe('TestSmsConfigDto', () => {
  it('accepts a valid phone', async () => {
    const errors = await validateDto({ toPhone: '+966501234567' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a phone at the MinLength(5) boundary', async () => {
    const errors = await validateDto({ toPhone: '+9665' });
    expect(errors.some((e) => e.property === 'toPhone')).toBe(false);
  });

  it('rejects a phone shorter than 5 chars', async () => {
    const errors = await validateDto({ toPhone: '+966' });
    expect(errors.some((e) => e.property === 'toPhone')).toBe(true);
  });

  it('rejects a missing toPhone', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'toPhone')).toBe(true);
  });

  it('rejects a non-string toPhone', async () => {
    const errors = await validateDto({ toPhone: 12345 });
    expect(errors.some((e) => e.property === 'toPhone')).toBe(true);
  });
});
