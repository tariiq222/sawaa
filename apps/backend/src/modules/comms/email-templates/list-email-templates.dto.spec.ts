import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListEmailTemplatesDto } from './list-email-templates.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListEmailTemplatesDto, plain);
  return validate(dto);
}

describe('ListEmailTemplatesDto', () => {
  it('accepts an empty payload (no filters)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts valid pagination', async () => {
    const errors = await validateDto({ page: 1, limit: 20 });
    expect(errors).toHaveLength(0);
  });

  it('coerces string pagination fields via Type(() => Number)', async () => {
    const errors = await validateDto({ page: '2', limit: '50' });
    expect(errors.some((e) => e.property === 'page')).toBe(false);
    expect(errors.some((e) => e.property === 'limit')).toBe(false);
  });

  it('rejects page < 1', async () => {
    const errors = await validateDto({ page: 0 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects limit exceeding 200', async () => {
    const errors = await validateDto({ limit: 201 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects non-integer limit', async () => {
    const errors = await validateDto({ limit: 1.5 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });
});
