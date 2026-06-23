import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendEmailDto } from './send-email.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(SendEmailDto, plain);
  return validate(dto);
}

describe('SendEmailDto', () => {
  const valid: Record<string, unknown> = {
    to: 'user@example.com',
    templateSlug: 'booking-confirmed',
    vars: { name: 'Fatima', date: '2026-04-17' },
  };

  it('accepts a valid payload', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing to', async () => {
    const errors = await validateDto({ templateSlug: valid.templateSlug, vars: valid.vars });
    expect(errors.some((e) => e.property === 'to')).toBe(true);
  });

  it('rejects a non-email to', async () => {
    const errors = await validateDto({ ...valid, to: 'not-an-email' });
    expect(errors.some((e) => e.property === 'to')).toBe(true);
  });

  it('rejects an empty to', async () => {
    const errors = await validateDto({ ...valid, to: '' });
    expect(errors.some((e) => e.property === 'to')).toBe(true);
  });

  it('rejects an empty templateSlug', async () => {
    const errors = await validateDto({ ...valid, templateSlug: '' });
    expect(errors.some((e) => e.property === 'templateSlug')).toBe(true);
  });

  it('rejects a missing templateSlug', async () => {
    const errors = await validateDto({ to: valid.to, vars: valid.vars });
    expect(errors.some((e) => e.property === 'templateSlug')).toBe(true);
  });

  it('rejects a non-object vars field', async () => {
    const errors = await validateDto({ ...valid, vars: 'not-an-object' });
    expect(errors.some((e) => e.property === 'vars')).toBe(true);
  });

  it('rejects a missing vars', async () => {
    const errors = await validateDto({ to: valid.to, templateSlug: valid.templateSlug });
    expect(errors.some((e) => e.property === 'vars')).toBe(true);
  });
});
