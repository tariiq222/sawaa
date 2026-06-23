import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetEmailTemplateDto } from './get-email-template.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(GetEmailTemplateDto, plain);
  return validate(dto);
}

describe('GetEmailTemplateDto', () => {
  it('accepts a valid UUID', async () => {
    const errors = await validateDto({ id: '00000000-0000-0000-0000-000000000000' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a v4 UUID with valid variant bits', async () => {
    const errors = await validateDto({ id: '12345678-1234-4234-8234-123456789abc' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID string', async () => {
    const errors = await validateDto({ id: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'id')).toBe(true);
  });

  it('rejects a missing id', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'id')).toBe(true);
  });

  it('rejects a numeric id', async () => {
    const errors = await validateDto({ id: 12345 });
    expect(errors.some((e) => e.property === 'id')).toBe(true);
  });
});
