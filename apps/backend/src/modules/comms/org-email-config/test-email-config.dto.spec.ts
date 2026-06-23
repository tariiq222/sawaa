import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TestEmailConfigDto } from './test-email-config.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(TestEmailConfigDto, plain);
  return validate(dto);
}

describe('TestEmailConfigDto', () => {
  it('accepts a valid email address', async () => {
    const errors = await validateDto({ toEmail: 'owner@clinic.com' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing toEmail', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'toEmail')).toBe(true);
  });

  it('rejects a non-email string', async () => {
    const errors = await validateDto({ toEmail: 'not-an-email' });
    expect(errors.some((e) => e.property === 'toEmail')).toBe(true);
  });

  it('rejects an empty toEmail', async () => {
    const errors = await validateDto({ toEmail: '' });
    expect(errors.some((e) => e.property === 'toEmail')).toBe(true);
  });

  it('rejects a numeric toEmail', async () => {
    const errors = await validateDto({ toEmail: 12345 });
    expect(errors.some((e) => e.property === 'toEmail')).toBe(true);
  });
});
